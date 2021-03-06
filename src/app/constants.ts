export class Constants {
  public static MAX_CONNECTION_ATTEMPTS = 20
  public static CONNECTION_ATTEMPT_TIMEOUT = 600

  public static API_URL = 'http://localhost:4201'

  public static SAMPLE_SCILLA_CODES = [`(* HelloWorld contract *)


(***************************************************)
(*               Associated library                *)
(***************************************************)
library HelloWorld

let one_msg = 
  fun (msg : Message) => 
  let nil_msg = Nil {Message} in
  Cons {Message} msg nil_msg

let not_owner_code = Int32 1
let set_hello_code = Int32 2

(***************************************************)
(*             The contract definition             *)
(***************************************************)

contract HelloWorld
(owner: Address)

field welcome_msg : String = ""

transition setHello (msg : String)
  is_owner = builtin eq owner _sender;
  match is_owner with
  | False =>
    msg = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : not_owner_code};
    msgs = one_msg msg;
    send msgs
  | True =>
    welcome_msg := msg;
    msg = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : set_hello_code};
    msgs = one_msg msg;
    send msgs
  end
end


transition getHello ()
    r <- welcome_msg;
    msg = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; msg : r};
    msgs = one_msg msg;
    send msgs
end`,
`(***************************************************)
(*               Associated library                *)
(***************************************************)
library Crowdfunding

let andb = 
  fun (b : Bool) =>
  fun (c : Bool) =>
    match b with 
    | False => False
    | True  =>
      match c with 
      | False => False
      | True  => True
      end
    end

let orb = 
  fun (b : Bool) => fun (c : Bool) =>
    match b with 
    | True  => True
    | False =>
      match c with 
      | False => False
      | True  => True
      end
    end

let negb = fun (b : Bool) => 
  match b with
  | True => False
  | False => True
  end

let one_msg = 
  fun (msg : Message) => 
    let nil_msg = Nil {Message} in
    Cons {Message} msg nil_msg
    
let check_update = 
  fun (bs : Map Address Uint128) =>
  fun (_sender : Address) =>
  fun (_amount : Uint128) =>
    let c = builtin contains bs _sender in
    match c with 
    | False => 
      let bs1 = builtin put bs _sender _amount in
      Some {Map Address Uint128} bs1 
    | True  => None {Map Address Uint128}
    end

let blk_leq =
  fun (blk1 : BNum) =>
  fun (blk2 : BNum) =>
    let bc1 = builtin blt blk1 blk2 in 
    let bc2 = builtin eq blk1 blk2 in 
    orb bc1 bc2

let accepted_code = Int32 1
let missed_deadline_code = Int32 2
let already_backed_code  = Int32 3
let not_owner_code  = Int32 4
let too_early_code  = Int32 5
let got_funds_code  = Int32 6
let cannot_get_funds  = Int32 7
let cannot_reclaim_code = Int32 8
let reclaimed_code = Int32 9
  
(***************************************************)
(*             The contract definition             *)
(***************************************************)
contract Crowdfunding

(*  Parameters *)
(owner     : Address,
 max_block : BNum,
 goal      : Uint128)

(* Mutable fields *)
field backers : Map Address Uint128 = Emp Address Uint128
field funded : Bool = False

transition Donate ()
  blk <- & BLOCKNUMBER;
  in_time = blk_leq blk max_block;
  match in_time with 
  | True  => 
    bs  <- backers;
    res = check_update bs _sender _amount;
    match res with
    | None => 
      msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0; 
              code : already_backed_code};
      msgs = one_msg msg;
      send msgs
    | Some bs1 =>
      backers := bs1; 
      accept; 
      msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0; 
              code : accepted_code};
      msgs = one_msg msg;
      send msgs     
    end  
  | False => 
    msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0; 
            code : missed_deadline_code};
    msgs = one_msg msg;
    send msgs
  end 
end

transition GetFunds ()
  is_owner = builtin eq owner _sender;
  match is_owner with
  | False => 
    msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0;
            code : not_owner_code};
    msgs = one_msg msg;
    send msgs
  | True => 
    blk <- & BLOCKNUMBER;
    in_time = blk_leq blk max_block;
    c1 = negb in_time;
    bal <- balance;
    c2 = builtin lt bal goal;
    c3 = negb c2;
    c4 = andb c1 c3;
    match c4 with 
    | False =>  
      msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0;
              code : cannot_get_funds};
      msgs = one_msg msg;
      send msgs
    | True => 
      tt = True;
      funded := tt;
      msg  = {_tag : Main; _recipient : owner; _amount : bal; 
              code : got_funds_code};
      msgs = one_msg msg;
      send msgs
    end
  end   
end

(* transition ClaimBack *)
transition ClaimBack ()
  blk <- & BLOCKNUMBER;
  after_deadline = builtin blt max_block blk;
  match after_deadline with
  | False =>
    msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0;
            code : too_early_code};
    msgs = one_msg msg;
    send msgs
  | True =>
    bs <- backers;
    bal <- _balance;
    (* Goal has not been reached *)
    f <- funded;
    c1 = builtin lt bal goal;
    c2 = builtin contains bs _sender;
    c3 = negb f;
    c4 = andb c1 c2;
    c5 = andb c3 c4;
    match c5 with
    | False =>
      msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0;
              code : cannot_reclaim_code};
      msgs = one_msg msg;
      send msgs
    | True =>
      res = builtin get bs _sender;
      match res with
      | None =>
        msg  = {_tag : ""; _recipient : _sender; _amount : Uint128 0;
                code : cannot_reclaim_code};
        msgs = one_msg msg;
        send msgs
      | Some v =>
        bs1 = builtin remove bs _sender;
        backers := bs1;
        msg  = {_tag : Main; _recipient : _sender; _amount : v; 
                code : reclaimed_code};
        msgs = one_msg msg;
        send msgs
      end
    end
  end  
end`,
`(* This contract implements a fungible token interface a la ERC20.*)
(* This contract does not fire events *)


(***************************************************)
(*               Associated library                *)
(***************************************************)
library FungibleToken

let one_msg = 
  fun (msg : Message) => 
  let nil_msg = Nil {Message} in
  Cons {Message} msg nil_msg

let no_msg = Nil {Message}

let min_int =
  fun (a : Uint128) => fun (b : Uint128) =>
  let alt = builtin lt a b in
  match alt with
  | True =>
    a
  | False =>
    b
  end

let le_int =
  fun (a : Uint128) => fun (b : Uin128) =>
    let x = builtin lt a b in
    match x with
    | True => True
    | False =>
      let y = builtin eq a b in
      match y with
      | True => True
      | False => False
      end
    end
    

(***************************************************)
(*             The contract definition             *)
(***************************************************)

contract FungibleToken
(owner : Address,
 total_tokens : Uint128)

(* Initial balance is not stated explicitly: it's initialized when creating the contract. *)

field balances : Map Address Uint128 =
  let m = Emp Address Uint128 in
    builtin put m owner total_tokens
field allowed : Map Address (Map Address Uint128) = Emp Address (Map Address Uint128)

transition BalanceOf (tokenOwner : Address)
  bl <- balances;
  val = builtin get bl tokenOwner;
  match val with
  | Some v =>
    msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; bal : v };
    msgs = one_msg msg;
    send msgs
  | None =>
    msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; bal : Uint128 0 };
    msgs = one_msg msg;
    send msgs
  end
end

transition TotalSupply ()
  msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; total_tokens : total_tokens};
  msgs = one_msg msg;
  send msgs
end

transition Transfer (to : Address, tokens : Uint128)
  bl <- balances;
  bal = builtin get bl _sender;
  match bal with
  | Some b =>
    can_do = le_int tokens b;
    match can_do with
    | True =>
      (* subtract tokens from _sender and add it to to *)
      new_sender_bal = builtin sub b tokens;
      new_balances = builtin put bl _sender new_sender_bal;
      to_bal = builtin get new_balances to;
      match to_bal with
      | Some x =>
        new_to_bal = builtin add x tokens;
        new_balances2 = builtin put new_balances to new_to_bal;
        balances := new_balances2
      | None =>
        new_balances3 = builtin put new_balances to tokens;
        balances := new_balances3
      end;
      msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; transferred : tokens };
      msgs = one_msg msg;
      send msgs
    | False =>
      (* balance not sufficient. *)
      msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; transferred : Uint128 0 };
      msgs = one_msg msg;
      send msgs
    end
  | None =>
    (* no balance record, can't transfer *)
    msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; transferred : Uint128 0 };
    msgs = one_msg msg;
    send msgs
  end
end

transition TransferFrom (from : Address, to : Address, tokens : Uint128)
  bl <- balances;
  al <- allowed;
  m_disallowed = "Transfer not allowed";
  bal = builtin get bl from;
  (* Check if _sender has been authorized by "from" *)
  allowed_from = builtin get al from;
  match allowed_from with
  | Some m =>
    (* How many tokens has _sender been authorized to transfer, by "from" *)
    sender_allowed_from = builtin get m _sender;
    all = Pair {Option(Uint128) Option(Uint128)} bal sender_allowed_from;
    match all with
    | Pair (Some a) (Some b) =>
      (* We can only transfer the minimum of available or authorized tokens *)
      t = min_int a b;
      can_do = le_int tokens t;
      match can_do with
      | True =>
        (* tokens is what we should subtract from "from" and add to "to" *)
        new_from_bal = builtin sub a tokens;
        balances_1 = builtin put bl from new_from_bal;
        balances := balances_1;
        to_bal = builtin get balances_1 to;
        match to_bal with
        | Some tb =>
          to_bal_new = builtin add tb tokens;
          balances_2 = builtin put balances_1 to to_bal_new;
          balances := balances_2;
          send no_msg
        | None =>
          (* "to" has no balance. So just set it to tokens *)
          balances_3 = builtin put balances_1 to tokens;
          balances := balances_3;
          send no_msg
        end;
        (* reduce "allowed" by "tokens" *)
        new_allowed = builtin sub b tokens;
        new_m = builtin put m _sender new_allowed;
        new_allowed = builtin put al from new_m;
        allowed := new_allowed
      | False =>
        msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; message : m_disallowed };
        msgs = one_msg msg;
        send msgs
      end
    | _ =>
      msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; message : m_disallowed };
      msgs = one_msg msg;
      send msgs
    end
  | None =>
    msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; message : m_disallowed };
    msgs = one_msg msg;
    send msgs
  end
end

transition Approve (spender : Address, tokens : Uint128)
  al <- allowed;
  sender_map = builtin get al _sender;
  match sender_map with
  | Some m =>
    allowed_to_spender = builtin put m spender tokens;
    allowed_new = builtin put al _sender allowed_to_spender;
    allowed := allowed_new;
    send no_msg
  | None =>
    allowed_to_spender = let m = Emp Address Uint128 in builtin put m spender tokens;
    allowed_new = builtin put al _sender allowed_to_spender;
    allowed := allowed_new;
    send no_msg
  end
end

transition Allowance (tokenOwner : Address, spender : Address)
  al <- allowed;
  towner_map = builtin get al tokenOwner;
  match towner_map with
  | Some m =>
    spender_allowance = builtin get m spender;
    match spender_allowance with
    | Some n =>
      msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; allowed : n };
      msgs = one_msg msg;
      send msgs
    | None =>
      msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; allowed : Uint128 0 };
      msgs = one_msg msg;
      send msgs
    end
  | None =>
    msg = { _tag : "Main"; _recipient : _sender; _amount : Uint128 0; allowed : Uint128 0 };
    msgs = one_msg msg;
    send msgs
  end
end`,
`(***************************************************)
(*               Associated library                *)
(***************************************************)
library ZilGame

let andb = 
  fun (b : Bool) => fun (c : Bool) =>
    match b with 
    | False => False
    | True  =>
      match c with 
      | False => False
      | True  => True
      end
    end

let orb = 
  fun (b : Bool) => fun (c : Bool) =>
    match b with 
    | True  => True
    | False =>
      match c with 
      | False => False
      | True  => True
      end
    end

let negb = fun (b : Bool) => 
  match b with
  | True => False
  | False => True
  end

let one_msg = 
  fun (msg : Message) => 
    let nil_msg = Nil {Message} in
    Cons {Message} msg nil_msg

let no_msg = Nil {Message}

let update_hash = 
  fun (oh : Option Hash) =>
  fun (h : Hash) =>
    match oh with
    | Some x => Some {Hash} x
    | None   => Some {Hash} h
    end

let update_timer = 
  fun (tm : Option BNum) =>
  fun (b : BNum) =>
    match tm with
    | Some x => Some {BNum} x
    | None   =>
      let window = Uint32 11 in
      let b1 = builtin badd b window in
      Some {BNum} b1
    end

(* b is within the time window *)
let can_play = 
  fun (tm : Option BNum) =>
  fun (b : BNum) =>
    match tm with
    | None => True
    | Some b1 => builtin blt b b1
    end     

let time_to_claim = 
  fun (tm : Option BNum) =>
  fun (b : BNum) =>
    match tm with
    | None => False
    | Some b1 =>
      let c1 = builtin blt b b1 in
      negb c1
    end     

let check_validity = 
  fun (a        : Address) =>
  fun (solution : Int128) =>
  fun (pa       : Address) =>
  fun (pb       : Address) =>
  fun (guess_a  : Option Hash) =>
  fun (guess_b  : Option Hash) =>
    let ca = builtin eq pa a in
    let cb = builtin eq pb a in
    let xa = Pair {Bool (Option Hash)} ca guess_a in 
    let xb = Pair {Bool (Option Hash)} cb guess_b in 
    match xa with
    | Pair True (Some g) =>
      let h = builtin sha256hash solution in
      builtin eq h g 
    | _ =>
      match xb with
      | Pair True (Some g) =>
        let h = builtin sha256hash solution in
        builtin eq h g
      | _ => False  
      end  
    | _ => False
    end

(* Owner can withdraw balance if deadline has passed *)
let can_withdraw =
  fun (timer : Option BNum) =>
  fun (b : BNum) =>
    match timer with
    | Some tm =>
      let window = Uint32 10 in
      let deadline = builtin badd tm window in
      let can = builtin blt deadline b in
      match can with
      | True => True
      | False => False
      end
    | None => False
    end

(* In the case of equal results, or no results the prise goes to the owner *)
let determine_winner = 
  fun (puzzle   : Hash) =>
  fun (guess_a  : Option Hash) =>
  fun (guess_b  : Option Hash) =>
  fun (pa       : Address) =>
  fun (pb       : Address) =>
  fun (oa       : Address) =>
    let gab = Pair { (Option Hash) (Option Hash) } guess_a guess_b in
    match gab with
    | Pair (Some ga) (Some gb) =>
      let d1 = builtin dist puzzle ga in
      let d2 = builtin dist puzzle gb in
      let c1 = builtin lt d1 d2 in
      match c1 with 
      | True => pa
      | False => 
        let c2 = builtin eq d1 d2 in
        match c2 with 
        | False => pb
        | True  => oa
        end
      end
    | Pair (Some _) None => pa
    | Pair None (Some _) => pb
    | Pair None None     => oa
    end

let solution_submitted = Int32 1
let time_window_missed = Int32 2
let not_a_player = Int32 3
let too_early_to_claim = Int32 4
let wrong__sender_or_solution = Int32 5
let here_is_the_reward = Int32 6
let cannot_withdraw = Int32 7

(***************************************************)
(*             The contract definition             *)
(***************************************************)
contract ZilGame 
(
owner    : Address,
player_a : Address,
player_b : Address,
puzzle   : Hash
)

(* Initial balance is not stated explicitly: it's initialized when creating the contract. *)

field player_a_hash : Option Hash = None {Hash}
field player_b_hash : Option Hash = None {Hash}
field timer         : Option BNum  = None {BNum}

transition Play (guess: Hash)
  tm_opt <- timer;
  b <- & BLOCKNUMBER;
  (* Check the timer *)
  c = can_play tm_opt b;
  match c with
  | False => 
    msg  = {_tag : Main; _recipient : _sender; _amount : Uint128 0; 
            code : time_window_missed};
    msgs = one_msg msg;
    send msgs        
  | True  => 
    isa = builtin eq _sender player_a;
    isb = builtin eq _sender player_b;
    tt = True;
    match isa with
    | True =>
      ah <- player_a_hash;
      hopt = update_hash ah guess;
      player_a_hash := hopt;
      tm1 = update_timer tm_opt b;
      timer := tm1;
      msg  = {_tag : Main; _recipient : _sender; _amount : Uint128 0; 
              code : solution_submitted};
      msgs = one_msg msg;
      send msgs        
    | False =>
      match isb with 
      | True =>
        bh <- player_b_hash;
        hopt = update_hash bh guess;
        player_b_hash := hopt;
        tm1 = update_timer tm_opt b;
        timer := tm1;
        msg  = {_tag : Main; _recipient : _sender; _amount : Uint128 0; 
                code : solution_submitted};
        msgs = one_msg msg;
        send msgs        
      | False => 
        msg  = {_tag : Main; _recipient : _sender; _amount : Uint128 0;
                code : not_a_player};
        msgs = one_msg msg;
        send msgs
      end  
    end
  end
end

transition ClaimReward(solution: Int128)
  tm_opt <- timer;
  b <- & BLOCKNUMBER;
  (* Check the timer *)
  ttc = time_to_claim tm_opt b;
  match ttc with
  | False => 
    msg  = {_tag : Main; _recipient : _sender; _amount : Uint128 0;
            code : too_early_to_claim};
    msgs = one_msg msg;
    send msgs        
  | True  => 
    pa <- player_a_hash;
    pb <- player_b_hash;
    is_valid = check_validity _sender solution player_a player_b pa pb;
    match is_valid with
    | False =>
      msg  = {_tag : Main; _recipient : _sender; _amount : Uint128 0;
              code : wrong__sender_or_solution};
      msgs = one_msg msg;
      send msgs        
    | True  =>
      winner = determine_winner puzzle pa pb player_a player_b owner; 
      bal <- _balance;
      msg  = {_tag : Main; _recipient : winner; _amount : bal; 
              code : here_is_the_reward};
      ff = False;         
      msgs = one_msg msg;
      send msgs
    end
  end
end

transition Withdraw ()
  tm_opt <- timer;
  b <- &BLOCKNUMBER;
  cw = can_withdraw tm_opt b;
  is_owner = builtin eq owner _sender;
  bal <- _balance;
  good_to_go = andb cw is_owner;
  match good_to_go with
  | True =>
    msg = {_tag : Main; _recipient : owner; _amount : bal; code : here_is_the_reward};
    msgs = one_msg msg;
    send msgs
  | False =>
    msg = {_tag : Main; _recipient : _sender; _amount : Uint128 0; code : cannot_withdraw};
    msgs = one_msg msg;
    send msgs
  end
end`,
`(***************************************************)
(*               Associated library                *)
(***************************************************)

library OpenAuction

let andb = 
  fun (b : Bool) =>
  fun (c : Bool) =>
    match b with 
    | False => False
    | True  =>
      match c with 
      | False => False
      | True  => True
      end
    end

let orb = 
  fun (b : Bool) => fun (c : Bool) =>
    match b with 
    | True  => True
    | False =>
      match c with 
      | False => False
      | True  => True
      end
    end

let negb = fun (b : Bool) => 
  match b with
  | True => False
  | False => True
  end

let blk_leq =
  fun (blk1 : BNum) =>
  fun (blk2 : BNum) =>
    let bc1 = builtin blt blk1 blk2 in 
    let bc2 = builtin eq blk1 blk2 in 
    orb bc1 bc2


let one_msg = 
  fun (msg : Message) => 
    let nil_msg = Nil {Message} in
    Cons {Message} msg nil_msg
    
    
let late_to_bid_code = Int32 1
let too_early_to_bid_code = Int32 2
let bid_too_low_code = Int32 3
let first_bid_accepted_code  = Int32 4
let bid_accepted_code  = Int32 5
let money_sent_code  = Int32 6
let nothing_to_withdraw_code  = Int32 7
let auction_is_still_on_code  = Int32 8
let auction_end_code  = Int32 9
   
    

(***************************************************)
(*             The contract definition             *)
(***************************************************)


contract OpenAuction
(*  Parameters *)
(auctionStart : BNum,
 biddingTime  : Uint128,
 beneficiary  : Address
)

(* Mutable fields *)

field ended : Bool = False
field highestBidder  : Option Address  = None {Address}
field highestBid     : Uint128 = Uint128 0
field pendingReturns : Map Address Uint128 = Emp Address Uint128


(* Transition 1: bidding *)
transition Bid ()
  blk <- & BLOCKNUMBER;
  endtime = builtin badd auctionStart biddingTime;
  after_end = let one = Uint128 1 
    in builtin badd endtime one;
  e <- ended;
  in_time = blk_leq after_end blk;
  flag1 = orb in_time e;
  early = blk_leq blk auctionStart;
  match early with
   | True =>
      msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : too_early_to_bid_code};
      msgs = one_msg msg;
      send msgs
  | False =>
    match flag1 with
    | True => 
      msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : late_to_bid_code};
      msgs = one_msg msg;
      send msgs
    | False =>
      hb <- highestBid;
      tmp1 = builtin lt hb _amount;
      match tmp1 with 
      | False =>
        msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : bid_too_low_code};
        msgs = one_msg msg;
        send msgs
      | True =>
        accept;
        hbPrev <- highestBidder;
        prs <- pendingReturns;
        match hbPrev with
        | Some v => 
          tmp2 = builtin contains prs v;
          match tmp2 with
          | True =>
            pr = builtin get prs v;
            hs1 = builtin add pr hb;
            prs1 = builtin put prs v hs1;
            pendingReturns := prs1;
            bidder = Some {Address} _sender;
            highestBidder := bidder;
            highestBid := _amount;
            msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : bid_accepted_code};
            msgs = one_msg msg;
            send msgs
          | False =>
            prs1 = builtin put prs v hb; 
            pendingReturns := prs1;
            bidder = Some {Address} _sender;
            highestBidder := bidder;
            highestBid := _amount;
            msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : bid_accepted_code};
            msgs = one_msg msg;
            send msgs
          end
        | None =>
          first_bidder = Some {Address} _sender;
          highestBidder := first_bidder;
          highestBid := _amount;
          msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : first_bid_accepted_code};
          msgs = one_msg msg;
          send msgs
        end
      end
    end
  end
end  
  

(* Transition 2: claiming money back *)
transition Withdraw ()
  prs <- pendingReturns;
  pr = builtin get prs _sender;
  match pr with
  | None =>
    msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : nothing_to_withdraw_code};
    msgs = one_msg msg;
    send msgs
  | Some v =>
    prs1 = builtin remove prs _sender; 
    pendingReturns := prs1;
    msg  = {_tag : "Main"; _recipient : _sender; _amount : v; code : money_sent_code};
    msgs = one_msg msg;
    send msgs
  end 
end


(* Transition 3: auction ends *)
transition AuctionEnd ()
  blk <- & BLOCKNUMBER;
  e <- ended;
  t1 = builtin badd auctionStart biddingTime;
  t2 = blk_leq t1 blk;
  t3 = negb e;
  t4 = andb t2 t3;
  match t4 with
  | False =>
    msg  = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : auction_is_still_on_code};
    msgs = one_msg msg;
    send msgs
  | True =>
    tt = True;
    ended := tt;    
    hb <- highestBid;
    msg  = {_tag : "Main"; _recipient : beneficiary; _amount : hb; code : auction_end_code; highest_bid : hb};
    msgs = one_msg msg;
    send msgs
  end
end`]
}