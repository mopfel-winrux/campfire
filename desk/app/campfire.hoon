::  campfire: room management agent + public guest signaling
::
/-  campfire
/+  default-agent, dbug
|%
+$  versioned-state
  $%  state-0
      state-1
  ==
::
+$  state-0
  $:  %0
      host-rooms=(map room-id:campfire room:campfire)
      join-rooms=(map [host=@p name=room-id:campfire] room:campfire)
  ==
::
+$  state-1
  $:  %1
      host-rooms=(map room-id:campfire room:campfire)
      join-rooms=(map [host=@p name=room-id:campfire] room:campfire)
      guests=(map guest-id:campfire guest-session:campfire)
  ==
::
+$  card  card:agent:gall
--
::
%-  agent:dbug
=|  state=state-1
^-  agent:gall
=<
|_  =bowl:gall
+*  this     .
    default  ~(. (default-agent this %|) bowl)
    hc       ~(. +> [bowl state])
::
++  on-init
  ^-  (quip card _this)
  :_  this
  :~  :*  %pass  /eyre/connect
          %arvo  %e  %connect
          [~ /'apps'/'campfire'/'public']
          dap.bowl
      ==
  ==
::
++  on-save  !>(state)
::
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state vase)
  ?-  -.old
      %0
    =/  new=state-1
      :*  %1
          host-rooms.old
          join-rooms.old
          *(map guest-id:campfire guest-session:campfire)
      ==
    :_  this(state new)
    :~  :*  %pass  /eyre/connect
            %arvo  %e  %connect
            [~ /'apps'/'campfire'/'public']
            dap.bowl
        ==
    ==
  ::
      %1  `this(state old)
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:default mark vase)
      %campfire-action
    ?>  =(src.bowl our.bowl)
    =/  act  !<(action:campfire vase)
    =^  cards  state  (handle-action:hc act)
    [cards this]
  ::
      %campfire-remote-action
    =/  act  !<(remote-action:campfire vase)
    =^  cards  state  (handle-remote-action:hc act)
    [cards this]
  ::
      %campfire-host-signal
    ?>  =(src.bowl our.bowl)
    =/  sig  !<(host-signal:campfire vase)
    =^  cards  state  (handle-host-signal:hc sig)
    [cards this]
  ::
      %handle-http-request
    =+  !<([rid=@ta req=inbound-request:eyre] vase)
    =^  cards  state  (handle-http:hc rid req)
    [cards this]
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
    :~  [%give %fact ~[path] %campfire-update !>(`update:campfire`[%snapshot rm])]
    ==
  ::
      [%hosted ~]  `this
  ::
      [%joined ~]
    :_  this
    %+  turn  ~(val by join-rooms.state)
    |=(rm=room:campfire [%give %fact ~[path] %campfire-update !>(`update:campfire`[%snapshot rm])])
  ::
      [%public %room @ ~]
    ~&  >  "campfire: host watching public room {<path>}"
    `this
  ::
      [%http-response @ ~]  `this
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
      [%join @ ~]  `this
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
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:default wire sign)
      [%eyre %connect ~]
    ?>  ?=([%eyre %bound *] sign)
    ~?  !accepted.sign  [dap.bowl %eyre-binding-rejected]
    `this
  ==
::
++  on-fail   on-fail:default
--
::
::  helper core
::
|_  [=bowl:gall state=state-1]
::
++  handle-action
  |=  act=action:campfire
  ^-  (quip card state-1)
  ?-  -.act
      %create
    ~&  >  "campfire: creating room {<name.act>}"
    =/  rm=room:campfire
      [our.bowl name.act title.act (sy ~[our.bowl]) public.act now.bowl]
    `state(host-rooms (~(put by host-rooms.state) name.act rm))
  ::
      %join
    ~&  >  "campfire: joining {<name.act>} on {<host.act>}"
    :_  state
    :~  :*  %pass  /join/[name.act]
            %agent  [host.act %campfire]
            %poke  %campfire-remote-action
            !>(`remote-action:campfire`[%join name.act])
        ==
        :*  %pass  /room/(scot %p host.act)/[name.act]
            %agent  [host.act %campfire]
            %watch  /room/[name.act]
        ==
    ==
  ::
      %leave
    ~&  >  "campfire: leaving {<name.act>} on {<host.act>}"
    :_  state(join-rooms (~(del by join-rooms.state) [host.act name.act]))
    :~  :*  %pass  /leave/[name.act]
            %agent  [host.act %campfire]
            %poke  %campfire-remote-action
            !>(`remote-action:campfire`[%leave name.act])
        ==
        :*  %pass  /room/(scot %p host.act)/[name.act]
            %agent  [host.act %campfire]
            %leave  ~
        ==
    ==
  ::
      %close
    ~&  >  "campfire: closing room {<name.act>}"
    :_  state(host-rooms (~(del by host-rooms.state) name.act))
    :~  :*  %give  %fact
            ~[/room/[name.act]]
            %campfire-update  !>(`update:campfire`[%closed name.act])
        ==
        [%give %kick ~[/room/[name.act]] ~]
    ==
  ==
::
++  handle-remote-action
  |=  act=remote-action:campfire
  ^-  (quip card state-1)
  ?-  -.act
      %join
    ~&  >  "campfire: {<src.bowl>} joining {<name.act>}"
    =/  rm=room:campfire  (~(got by host-rooms.state) name.act)
    =/  new-rm  rm(members (~(put in members.rm) src.bowl))
    :_  state(host-rooms (~(put by host-rooms.state) name.act new-rm))
    :~  :*  %give  %fact
            ~[/room/[name.act]]
            %campfire-update  !>(`update:campfire`[%joined name.act src.bowl])
        ==
    ==
  ::
      %leave
    ~&  >  "campfire: {<src.bowl>} leaving {<name.act>}"
    =/  rm=room:campfire  (~(got by host-rooms.state) name.act)
    =/  new-rm  rm(members (~(del in members.rm) src.bowl))
    :_  state(host-rooms (~(put by host-rooms.state) name.act new-rm))
    :~  :*  %give  %fact
            ~[/room/[name.act]]
            %campfire-update  !>(`update:campfire`[%left name.act src.bowl])
        ==
    ==
  ==
::
++  handle-host-signal
  |=  sig=host-signal:campfire
  ^-  (quip card state-1)
  =/  gid=guest-id:campfire
    ?-  -.sig
      %answer    guest-id.sig
      %host-ice  guest-id.sig
      %kick      guest-id.sig
    ==
  =/  g  (~(get by guests.state) gid)
  ?~  g  `state
  =/  ev=guest-event:campfire
    ?-  -.sig
      %answer    [%answer sdp.sig]
      %host-ice  [%ice candidate.sig]
      %kick      [%closed ~]
    ==
  =/  new-g  u.g(outbox (snoc outbox.u.g ev), last-seen now.bowl)
  `state(guests (~(put by guests.state) gid new-g))
::
++  handle-http
  |=  [rid=@ta req=inbound-request:eyre]
  ^-  (quip card state-1)
  ::  GC stale guests (last-seen older than 5 minutes)
  =/  cutoff  (sub now.bowl ~m5)
  =/  fresh-guests
    %-  malt
    %+  skim  ~(tap by guests.state)
    |=  [gid=guest-id:campfire g=guest-session:campfire]
    (gth last-seen.g cutoff)
  =.  state  state(guests fresh-guests)
  ::
  =*  url  url.request.req
  =/  method  method.request.req
  =/  parsed  (rush url ;~(plug apat:de-purl:html yque:de-purl:html))
  =/  pax=(list @t)
    ?~  parsed  ~
    =/  pok=pork:eyre  -.u.parsed
    q.pok
  ::
  ?:  ?=(%'OPTIONS' method)
    [(respond-raw rid 204 cors-headers ~) state]
  ::
  ?+    pax  [(respond-raw rid 404 text-headers `(as-octs:mimes:html 'not found')) state]
      [%'apps' %'campfire' %'public' ~]
    [(respond-raw rid 200 html-headers `(as-octs:mimes:html 'Campfire public rooms')) state]
  ::
      [%'apps' %'campfire' %'public' %'room' @ @ ~]
    [(respond-raw rid 200 html-headers `(as-octs:mimes:html guest-html)) state]
  ::
      [%'apps' %'campfire' %'public' %'api' %'join' ~]
    ?.  ?=(%'POST' method)
      [(respond-raw rid 405 text-headers `(as-octs:mimes:html 'method not allowed')) state]
    (api-join rid req)
  ::
      [%'apps' %'campfire' %'public' %'api' %'poll' ~]
    ?.  ?=(%'GET' method)
      [(respond-raw rid 405 text-headers `(as-octs:mimes:html 'method not allowed')) state]
    (api-poll rid req)
  ::
      [%'apps' %'campfire' %'public' %'api' %'signal' ~]
    ?.  ?=(%'POST' method)
      [(respond-raw rid 405 text-headers `(as-octs:mimes:html 'method not allowed')) state]
    (api-signal rid req)
  ::
      [%'apps' %'campfire' %'public' %'api' %'leave' ~]
    ?.  ?=(%'POST' method)
      [(respond-raw rid 405 text-headers `(as-octs:mimes:html 'method not allowed')) state]
    (api-leave rid req)
  ==
::
++  api-join
  |=  [rid=@ta req=inbound-request:eyre]
  ^-  (quip card state-1)
  =/  jon  (get-body-json req)
  ?~  jon  [(respond-text rid 400 'invalid json') state]
  =/  room-name  (get-str u.jon 'room')
  =/  display-name  (get-str u.jon 'displayName')
  =/  offer  (get-str u.jon 'offer')
  =/  host-str  (get-str u.jon 'host')
  ?~  room-name  [(respond-text rid 400 'missing room') state]
  ?~  display-name  [(respond-text rid 400 'missing displayName') state]
  ?~  offer  [(respond-text rid 400 'missing offer') state]
  ?~  host-str  [(respond-text rid 400 'missing host') state]
  =/  host-ship  (slaw %p u.host-str)
  ?~  host-ship  [(respond-text rid 400 'invalid host') state]
  ?.  =(u.host-ship our.bowl)
    [(respond-text rid 400 'wrong host') state]
  =/  rm  (~(get by host-rooms.state) `@ta`u.room-name)
  ?~  rm  [(respond-text rid 404 'room not found') state]
  ?.  public.u.rm  [(respond-text rid 403 'room is not public') state]
  ::
  =/  gid=guest-id:campfire  (gen-uid 1)
  =/  tok=guest-token:campfire  (gen-uid 2)
  =/  sess=guest-session:campfire
    :*  room=`@ta`u.room-name
        token=tok
        display-name=u.display-name
        offer=u.offer
        outbox=~
        last-seen=now.bowl
    ==
  =/  resp-json=json
    %-  pairs:enjs:format
    :~  ['guestId' s+gid]
        ['token' s+tok]
    ==
  =/  notify-json=json
    %-  pairs:enjs:format
    :~  ['type' s+'guest-join']
        ['guestId' s+gid]
        ['displayName' s+u.display-name]
        ['offer' s+u.offer]
    ==
  =/  notify=card
    :*  %give  %fact
        ~[/public/room/[`@ta`u.room-name]]
        [%json !>(notify-json)]
    ==
  ~&  >  "campfire: new guest {<gid>} for room {<u.room-name>}"
  :_  state(guests (~(put by guests.state) gid sess))
  :-  notify
  (respond-json rid resp-json)
::
++  api-poll
  |=  [rid=@ta req=inbound-request:eyre]
  ^-  (quip card state-1)
  =/  parsed  (rush url.request.req ;~(plug apat:de-purl:html yque:de-purl:html))
  =/  args=(list [k=@t v=@t])
    ?~  parsed  ~
    =/  qry=quay:eyre  +.u.parsed
    qry
  =/  gid-str  (find-arg args 'guestId')
  =/  tok-str  (find-arg args 'token')
  ?~  gid-str  [(respond-text rid 400 'missing guestId') state]
  ?~  tok-str  [(respond-text rid 400 'missing token') state]
  =/  g  (~(get by guests.state) `@ta`u.gid-str)
  ?~  g  [(respond-text rid 404 'guest not found') state]
  ?.  =(token.u.g `@ta`u.tok-str)  [(respond-text rid 403 'bad token') state]
  ::
  =/  events-json=json
    :-  %a
    %+  turn  outbox.u.g
    |=  ev=guest-event:campfire
    ^-  json
    ?-  -.ev
        %answer
      %-  pairs:enjs:format
      :~  ['kind' s+'answer']
          ['sdp' s+sdp.ev]
      ==
        %ice
      %-  pairs:enjs:format
      :~  ['kind' s+'ice']
          ['candidate' s+candidate.ev]
      ==
        %closed
      %-  pairs:enjs:format
      :~  ['kind' s+'closed']  ==
    ==
  =/  resp-json=json
    (pairs:enjs:format ['events' events-json] ~)
  =/  new-g  u.g(outbox ~, last-seen now.bowl)
  :-  (respond-json rid resp-json)
  state(guests (~(put by guests.state) `@ta`u.gid-str new-g))
::
++  api-signal
  |=  [rid=@ta req=inbound-request:eyre]
  ^-  (quip card state-1)
  =/  jon  (get-body-json req)
  ?~  jon  [(respond-text rid 400 'invalid json') state]
  =/  gid-str  (get-str u.jon 'guestId')
  =/  tok-str  (get-str u.jon 'token')
  =/  kind  (get-str u.jon 'kind')
  =/  data  (get-str u.jon 'data')
  ?~  gid-str  [(respond-text rid 400 'missing guestId') state]
  ?~  tok-str  [(respond-text rid 400 'missing token') state]
  ?~  kind  [(respond-text rid 400 'missing kind') state]
  =/  g  (~(get by guests.state) `@ta`u.gid-str)
  ?~  g  [(respond-text rid 404 'guest not found') state]
  ?.  =(token.u.g `@ta`u.tok-str)  [(respond-text rid 403 'bad token') state]
  ::
  ?:  =(u.kind 'ice')
    ?~  data  [(respond-text rid 400 'missing data') state]
    =/  new-g  u.g(last-seen now.bowl)
    =/  notify-json=json
      %-  pairs:enjs:format
      :~  ['type' s+'guest-ice']
          ['guestId' s+`@ta`u.gid-str]
          ['candidate' s+u.data]
      ==
    =/  notify=card
      :*  %give  %fact
          ~[/public/room/[room.u.g]]
          [%json !>(notify-json)]
      ==
    :_  state(guests (~(put by guests.state) `@ta`u.gid-str new-g))
    :-  notify
    (respond-json rid (pairs:enjs:format ['ok' b+%.y] ~))
  ::
  ?:  =(u.kind 'leave')
    =/  notify-json=json
      %-  pairs:enjs:format
      :~  ['type' s+'guest-left']
          ['guestId' s+`@ta`u.gid-str]
      ==
    =/  notify=card
      :*  %give  %fact
          ~[/public/room/[room.u.g]]
          [%json !>(notify-json)]
      ==
    :_  state(guests (~(del by guests.state) `@ta`u.gid-str))
    :-  notify
    (respond-json rid (pairs:enjs:format ['ok' b+%.y] ~))
  ::
  [(respond-text rid 400 'unknown kind') state]
::
++  api-leave
  |=  [rid=@ta req=inbound-request:eyre]
  ^-  (quip card state-1)
  =/  jon  (get-body-json req)
  ?~  jon  [(respond-text rid 400 'invalid json') state]
  =/  gid-str  (get-str u.jon 'guestId')
  =/  tok-str  (get-str u.jon 'token')
  ?~  gid-str  [(respond-text rid 400 'missing guestId') state]
  ?~  tok-str  [(respond-text rid 400 'missing token') state]
  =/  g  (~(get by guests.state) `@ta`u.gid-str)
  ?~  g  [(respond-json rid (pairs:enjs:format ['ok' b+%.y] ~)) state]
  ?.  =(token.u.g `@ta`u.tok-str)  [(respond-text rid 403 'bad token') state]
  =/  notify-json=json
    %-  pairs:enjs:format
    :~  ['type' s+'guest-left']
        ['guestId' s+`@ta`u.gid-str]
    ==
  =/  notify=card
    :*  %give  %fact
        ~[/public/room/[room.u.g]]
        [%json !>(notify-json)]
    ==
  :_  state(guests (~(del by guests.state) `@ta`u.gid-str))
  :-  notify
  (respond-json rid (pairs:enjs:format ['ok' b+%.y] ~))
::
++  get-body-json
  |=  req=inbound-request:eyre
  ^-  (unit json)
  ?~  body.request.req  ~
  (de:json:html q.u.body.request.req)
::
++  get-str
  |=  [jon=json key=@t]
  ^-  (unit @t)
  ?.  ?=([%o *] jon)  ~
  =/  v  (~(get by p.jon) key)
  ?~  v  ~
  ?.  ?=([%s *] u.v)  ~
  `p.u.v
::
++  find-arg
  |=  [args=(list [k=@t v=@t]) key=@t]
  ^-  (unit @t)
  ?~  args  ~
  ?:  =(k.i.args key)  `v.i.args
  $(args t.args)
::
++  gen-uid
  |=  seed=@
  ^-  @ta
  (scot %uv (shaw now.bowl 64 (mix seed eny.bowl)))
::
++  cors-headers
  ^-  (list [@t @t])
  :~  ['access-control-allow-origin' '*']
      ['access-control-allow-methods' 'GET, POST, OPTIONS']
      ['access-control-allow-headers' 'content-type']
  ==
::
++  html-headers
  ^-  (list [@t @t])
  :-  ['content-type' 'text/html; charset=utf-8']
  cors-headers
::
++  text-headers
  ^-  (list [@t @t])
  :-  ['content-type' 'text/plain; charset=utf-8']
  cors-headers
::
++  json-headers
  ^-  (list [@t @t])
  :-  ['content-type' 'application/json']
  cors-headers
::
++  respond-json
  |=  [rid=@ta jon=json]
  ^-  (list card)
  (respond-raw rid 200 json-headers `(as-octs:mimes:html (en:json:html jon)))
::
++  respond-text
  |=  [rid=@ta status=@ud msg=@t]
  ^-  (list card)
  (respond-raw rid status text-headers `(as-octs:mimes:html msg))
::
++  respond-raw
  |=  [rid=@ta status=@ud hdrs=(list [@t @t]) body=(unit octs)]
  ^-  (list card)
  =/  hdr=response-header:http  [status hdrs]
  :~  [%give %fact ~[/http-response/[rid]] %http-response-header !>(hdr)]
      [%give %fact ~[/http-response/[rid]] %http-response-data !>(body)]
      [%give %kick ~[/http-response/[rid]] ~]
  ==
::
++  guest-html
  ^~
  '''
  <!doctype html>
  <html lang="en">
  <head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Campfire Guest</title>
  <style>
  body { margin: 0; background: #1c1917; color: #fafaf9; font-family: -apple-system, sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .prompt { max-width: 400px; width: 90%; padding: 24px; background: #292524; border: 1px solid #44403c; border-radius: 12px; }
  h1 { margin: 0 0 16px; font-size: 24px; font-weight: 300; color: #fcd34d; }
  .room { color: #a8a29e; font-size: 14px; margin-bottom: 16px; font-family: monospace; }
  input { width: 100%; background: #1c1917; border: 1px solid #44403c; border-radius: 6px; padding: 12px; color: #fafaf9; font-size: 14px; box-sizing: border-box; margin-bottom: 12px; }
  button { background: #d97706; color: #1c1917; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; cursor: pointer; width: 100%; font-size: 14px; }
  button:disabled { background: #44403c; color: #78716c; cursor: default; }
  .call { display: none; flex-direction: column; align-items: center; width: 100%; height: 100vh; justify-content: center; }
  .call.active { display: flex; }
  .prompt.hidden { display: none; }
  video { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; background: #0c0a09; }
  .remote-grid { display: grid; gap: 8px; padding: 16px; max-width: 90vw; max-height: 80vh; }
  .remote-grid.count-1 { grid-template-columns: 1fr; }
  .remote-grid.count-2 { grid-template-columns: 1fr 1fr; }
  .remote-grid.count-3, .remote-grid.count-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .remote-tile { aspect-ratio: 16/9; min-width: 280px; }
  #local { position: fixed; top: 16px; right: 16px; width: 160px; height: 120px; border: 1px solid #44403c; z-index: 10; }
  .controls { margin-top: 16px; display: flex; gap: 12px; }
  .leave { background: #dc2626; color: white; }
  .status { color: #a8a29e; font-size: 12px; margin-top: 8px; }
  .error { color: #f87171; }
  </style>
  </head>
  <body>
  <div class="prompt" id="prompt">
    <h1>Campfire</h1>
    <div class="room" id="roomLabel"></div>
    <input id="name" placeholder="Your name" maxlength="32" />
    <button id="joinBtn">Join Room</button>
    <div class="status" id="status"></div>
  </div>
  <div class="call" id="callView">
    <div id="remoteGrid" class="remote-grid"></div>
    <video id="local" autoplay playsinline muted></video>
    <div class="controls">
      <button id="leaveBtn" class="leave">Leave</button>
    </div>
    <div class="status" id="callStatus"></div>
  </div>
  <script>
  (function() {
    var parts = location.pathname.split('/').filter(Boolean);
    // parts = ['apps', 'campfire', 'public', 'room', '~zod', 'room-name']
    var host = parts[4] || '';
    var roomName = parts[5] || '';
    document.getElementById('roomLabel').textContent = '~' + host.replace(/^~/, '') + '/' + roomName;
    var state = { guestId: null, token: null, pc: null, localStream: null, polling: false };
    var statusEl = document.getElementById('status');
    var callStatus = document.getElementById('callStatus');
    function setStatus(msg, isError) {
      statusEl.textContent = msg || '';
      statusEl.className = 'status' + (isError ? ' error' : '');
    }
    function api(path, opts) {
      return fetch('/apps/campfire/public/api/' + path, Object.assign({
        headers: { 'content-type': 'application/json' }
      }, opts || {})).then(function(r) {
        if (!r.ok) return r.text().then(function(t) { throw new Error(t || r.statusText); });
        return r.json();
      });
    }
    async function joinRoom() {
      var displayName = document.getElementById('name').value.trim();
      if (!displayName) { setStatus('Please enter a name', true); return; }
      document.getElementById('joinBtn').disabled = true;
      setStatus('Requesting camera...');
      try {
        state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (e) {
        try {
          state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e2) {
          setStatus('Could not access camera/microphone', true);
          document.getElementById('joinBtn').disabled = false;
          return;
        }
      }
      document.getElementById('local').srcObject = state.localStream;
      setStatus('Connecting...');
      state.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      state.localStream.getTracks().forEach(function(t) { state.pc.addTrack(t, state.localStream); });
      state.remoteStreams = {};
      state.pc.ontrack = function(evt) {
        var stream = evt.streams[0];
        if (!stream) return;
        if (state.remoteStreams[stream.id]) return;
        state.remoteStreams[stream.id] = stream;
        var grid = document.getElementById('remoteGrid');
        var tile = document.createElement('div');
        tile.className = 'remote-tile';
        tile.id = 'tile-' + stream.id;
        var v = document.createElement('video');
        v.autoplay = true;
        v.playsInline = true;
        v.srcObject = stream;
        tile.appendChild(v);
        grid.appendChild(tile);
        var count = Object.keys(state.remoteStreams).length;
        grid.className = 'remote-grid count-' + Math.min(count, 4);
        // remove tile when stream ends
        stream.addEventListener('removetrack', function() {
          if (stream.getTracks().length === 0) {
            var t = document.getElementById('tile-' + stream.id);
            if (t) t.remove();
            delete state.remoteStreams[stream.id];
            grid.className = 'remote-grid count-' + Math.min(Object.keys(state.remoteStreams).length, 4);
          }
        });
      };
      state.pc.onicecandidate = function(evt) {
        if (evt.candidate && state.guestId) {
          api('signal', {
            method: 'POST',
            body: JSON.stringify({
              guestId: state.guestId,
              token: state.token,
              kind: 'ice',
              data: JSON.stringify(evt.candidate.toJSON())
            })
          }).catch(function(e) { console.warn('ice post failed', e); });
        }
      };
      state.pc.onconnectionstatechange = function() {
        callStatus.textContent = 'Connection: ' + state.pc.connectionState;
      };
      var offer = await state.pc.createOffer();
      await state.pc.setLocalDescription(offer);
      try {
        var res = await api('join', {
          method: 'POST',
          body: JSON.stringify({
            room: roomName,
            host: '~' + host.replace(/^~/, ''),
            displayName: displayName,
            offer: offer.sdp
          })
        });
        state.guestId = res.guestId;
        state.token = res.token;
      } catch (e) {
        setStatus('Failed to join: ' + e.message, true);
        document.getElementById('joinBtn').disabled = false;
        return;
      }
      document.getElementById('prompt').classList.add('hidden');
      document.getElementById('callView').classList.add('active');
      state.polling = true;
      pollLoop();
    }
    async function pollLoop() {
      while (state.polling) {
        try {
          var res = await api('poll?guestId=' + encodeURIComponent(state.guestId) + '&token=' + encodeURIComponent(state.token));
          for (var i = 0; i < res.events.length; i++) {
            var ev = res.events[i];
            if (ev.kind === 'answer') {
              await state.pc.setRemoteDescription({ type: 'answer', sdp: ev.sdp });
            } else if (ev.kind === 'ice') {
              try {
                var cand = JSON.parse(ev.candidate);
                await state.pc.addIceCandidate(cand);
              } catch (e) { console.warn('bad ice', e); }
            } else if (ev.kind === 'closed') {
              leaveRoom();
              return;
            }
          }
        } catch (e) {
          console.warn('poll error', e);
        }
        await new Promise(function(r) { setTimeout(r, 500); });
      }
    }
    function leaveRoom() {
      state.polling = false;
      if (state.pc) { try { state.pc.close(); } catch (e) {} }
      if (state.localStream) state.localStream.getTracks().forEach(function(t) { t.stop(); });
      if (state.guestId) {
        api('leave', {
          method: 'POST',
          body: JSON.stringify({ guestId: state.guestId, token: state.token })
        }).catch(function() {});
      }
      document.getElementById('callView').classList.remove('active');
      document.getElementById('prompt').classList.remove('hidden');
      document.getElementById('joinBtn').disabled = false;
      setStatus('You left the room');
    }
    document.getElementById('joinBtn').addEventListener('click', joinRoom);
    document.getElementById('leaveBtn').addEventListener('click', leaveRoom);
    window.addEventListener('beforeunload', leaveRoom);
  })();
  </script>
  </body>
  </html>
  '''
--
