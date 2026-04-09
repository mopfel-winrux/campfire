/-  spider, rtcswitchboard
/+  strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:strand  bind:m  get-bowl:strandio
=/  uuid  'test-call-002'
::  place the call
;<  ~  bind:m
  (poke-our:strandio %rtcswitchboard %rtcswitchboard-from-client !>(`rtcswitchboard-from-client:rtcswitchboard`[uuid %place-call ~fel %campfire]))
::  subscribe to the call path (triggers dialing -> ring)
;<  ~  bind:m
  (watch-our:strandio /call/[uuid] %rtcswitchboard /call/[uuid])
::  wait for a fact (connection state update)
;<  =cage  bind:m
  (take-fact:strandio /call/[uuid])
~&  >  "got fact: {<p.cage>}"
::  wait for another fact
;<  =cage  bind:m
  (take-fact:strandio /call/[uuid])
~&  >  "got second fact: {<p.cage>}"
(pure:m !>("call placed and subscribed, uuid: {(trip uuid)}"))
