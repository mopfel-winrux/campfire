::  campfire: room management agent
::
/-  campfire
/+  default-agent, dbug, camp=campfire
|%
+$  versioned-state
  $%  state-0
  ==
+$  state-0
  $:  %0
      host-rooms=(map room-id:campfire room:campfire)
      join-rooms=(map [host=@p name=room-id:campfire] room:campfire)
  ==
+$  card  card:agent:gall
--
%-  agent:dbug
=|  state=state-0
^-  agent:gall
|_  =bowl:gall
+*  this     .
    default  ~(. (default-agent this %|) bowl)
::
++  on-init  `this
++  on-save  !>(state)
::
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state vase)
  ?-  -.old
    %0  `this(state old)
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:default mark vase)
      %campfire-action
    ?>  =(src.bowl our.bowl)
    =/  act  !<(action:campfire vase)
    ?-  -.act
        %create
      ~&  >  "campfire: creating room {<name.act>}"
      =/  rm=room:campfire
        [our.bowl name.act title.act (sy ~[our.bowl]) public.act now.bowl]
      `this(host-rooms.state (~(put by host-rooms.state) name.act rm))
      ::
        %join
      ~&  >  "campfire: joining {<name.act>} on {<host.act>}"
      :_  this
      :~  :*  %pass  /join/[name.act]
              %agent  [host.act %campfire]
              %poke  %campfire-remote-action  !>(`remote-action:campfire`[%join name.act])
          ==
          :*  %pass  /room/(scot %p host.act)/[name.act]
              %agent  [host.act %campfire]
              %watch  /room/[name.act]
          ==
      ==
      ::
        %leave
      ~&  >  "campfire: leaving {<name.act>} on {<host.act>}"
      :_  this(join-rooms.state (~(del by join-rooms.state) [host.act name.act]))
      :~  :*  %pass  /leave/[name.act]
              %agent  [host.act %campfire]
              %poke  %campfire-remote-action  !>(`remote-action:campfire`[%leave name.act])
          ==
          :*  %pass  /room/(scot %p host.act)/[name.act]
              %agent  [host.act %campfire]
              %leave  ~
          ==
      ==
      ::
        %close
      ~&  >  "campfire: closing room {<name.act>}"
      :_  this(host-rooms.state (~(del by host-rooms.state) name.act))
      :~  :*  %give  %fact
              ~[/room/[name.act]]
              %campfire-update  !>(`update:campfire`[%closed name.act])
          ==
          [%give %kick ~[/room/[name.act]] ~]
      ==
    ==
    ::
      %campfire-remote-action
    =/  act  !<(remote-action:campfire vase)
    ?-  -.act
        %join
      ~&  >  "campfire: {<src.bowl>} joining room {<name.act>}"
      =/  rm=room:campfire  (~(got by host-rooms.state) name.act)
      =/  new-rm  rm(members (~(put in members.rm) src.bowl))
      :_  this(host-rooms.state (~(put by host-rooms.state) name.act new-rm))
      :~  :*  %give  %fact
              ~[/room/[name.act]]
              %campfire-update  !>(`update:campfire`[%joined name.act src.bowl])
          ==
      ==
      ::
        %leave
      ~&  >  "campfire: {<src.bowl>} leaving room {<name.act>}"
      =/  rm=room:campfire  (~(got by host-rooms.state) name.act)
      =/  new-rm  rm(members (~(del in members.rm) src.bowl))
      :_  this(host-rooms.state (~(put by host-rooms.state) name.act new-rm))
      :~  :*  %give  %fact
              ~[/room/[name.act]]
              %campfire-update  !>(`update:campfire`[%left name.act src.bowl])
          ==
      ==
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:default path)
      [%room @ ~]
    =/  name  +<.path
    =/  rm=room:campfire  (~(got by host-rooms.state) name)
    :_  this
    :~  [%give %fact ~ %campfire-update !>(`update:campfire`[%snapshot rm])]
    ==
    ::
      [%hosted ~]  `this
      [%joined ~]
    ::  give initial snapshots for all joined rooms
    :_  this
    %+  turn  ~(val by join-rooms.state)
    |=(rm=room:campfire [%give %fact ~ %campfire-update !>(`update:campfire`[%snapshot rm])])
  ==
::
++  on-leave  |=(* `this)
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %hosted ~]
    ``campfire-rooms+!>(host-rooms.state)
      [%x %joined ~]
    =/  as-map=(map room-id:campfire room:campfire)
      %-  malt
      %+  turn  ~(val by join-rooms.state)
      |=(rm=room:campfire [name.rm rm])
    ``campfire-rooms+!>(as-map)
      [%x %room @ ~]
    =/  name  +>-.path
    =/  rm  (~(get by host-rooms.state) name)
    ?~  rm  [~ ~]
    ``campfire-update+!>(`update:campfire`[%snapshot u.rm])
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  (on-agent:default wire sign)
      [%join @ ~]
    ?+  -.sign  `this
      %poke-ack  `this
    ==
      [%leave @ ~]  `this
    ::
      [%room @ @ ~]
    =/  rhost  (slav %p +<.wire)
    =/  rname  +>-.wire
    ?+  -.sign  `this
        %fact
      ?>  =(%campfire-update p.cage.sign)
      =/  upd  !<(update:campfire q.cage.sign)
      =/  jrm  join-rooms.state
      ?-  -.upd
          %snapshot
        :_  this(join-rooms.state (~(put by jrm) [rhost rname] room.upd))
        :~  [%give %fact ~[/joined] cage.sign]
        ==
          %joined
        =/  rm=room:campfire  (~(got by jrm) [rhost rname])
        =/  new-rm  rm(members (~(put in members.rm) who.upd))
        :_  this(join-rooms.state (~(put by jrm) [rhost rname] new-rm))
        :~  [%give %fact ~[/joined] cage.sign]
        ==
          %left
        =/  rm=room:campfire  (~(got by jrm) [rhost rname])
        =/  new-rm  rm(members (~(del in members.rm) who.upd))
        :_  this(join-rooms.state (~(put by jrm) [rhost rname] new-rm))
        :~  [%give %fact ~[/joined] cage.sign]
        ==
          %closed
        :_  this(join-rooms.state (~(del by jrm) [rhost rname]))
        :~  [%give %fact ~[/joined] cage.sign]
        ==
      ==
        %kick
      :_  this
      :~  :*  %pass  /room/(scot %p rhost)/[rname]
              %agent  [rhost %campfire]
              %watch  /room/[rname]
          ==
      ==
    ==
  ==
::
++  on-arvo   on-arvo:default
++  on-fail   on-fail:default
--
