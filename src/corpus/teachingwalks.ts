// Authored walks over the CS TEACHING corpus — first-class narrative artifacts
// over the same graph `teachingdocs.ts` describes as terrain. Each walk is a
// story a teacher would actually tell across the map, and the stops
// deliberately jump domains where the story does: understanding lives in the
// crossings, not inside one country.

import type { Walk } from './walks'

export const TEACHING_WALKS: Walk[] = [
  {
    id: 'transistor-to-program',
    title: 'From transistor to running program',
    description:
      'The bottom-up ladder of computing: pure logic becomes silicon, silicon becomes a machine, ' +
      'a compiler crosses the abstraction gap, and the operating system turns one machine into many.',
    stops: [
      { id: 'dm-propositional-logic', note: 'Before any hardware: AND, OR, NOT as pure mathematics — truth as something you can calculate with.' },
      { id: 'dig-transistors-logic-gates', note: 'The same logic cast in silicon: a transistor is a switch, a few switches make a gate. Math becomes physics.' },
      { id: 'dig-binary-data-representation', note: 'Two voltage levels means base 2 — numbers, text, everything encoded as bit patterns the gates can chew.' },
      { id: 'dig-combinational-circuits', note: 'Gates compose into circuits that compute: an adder is just logic arranged to carry.' },
      { id: 'dig-sequential-logic-memory', note: 'Feedback lets a circuit remember. State is the difference between a calculator and a computer.' },
      { id: 'arc-instruction-set-architecture', note: 'Registers plus circuits plus a clock define a machine language — the contract everything above will speak.' },
      { id: 'arc-memory-hierarchy-caches', note: 'Where the program and its data actually live: a stack of memories, each pretending to be big AND fast.' },
      {
        id: 'pl-grammars-parsing',
        note: 'First twist — jump to languages: humans won’t write bit patterns, so source code needs structure a machine can recover.',
      },
      { id: 'pl-compilers-interpreters', note: 'The compiler crosses the map’s biggest gap: parsed source in, ISA instructions out.' },
      {
        id: 'os-processes-threads',
        note: 'Second twist — back into systems: the compiled program starts running and becomes a process, a living thing the OS manages.',
      },
      { id: 'os-virtual-memory', note: 'The process believes it owns all of memory. That belief is an illusion the OS maintains page by page.' },
      { id: 'os-cpu-scheduling', note: 'And it takes turns: the scheduler multiplexes the very CPU the walk started by building.' },
    ],
  },
  {
    id: 'loading-a-webpage',
    title: 'What happens when you load a webpage',
    description:
      'The classic interview question as a walk: from a typed name, down the protocol stack, through ' +
      'the cryptography that secures the connection, up to the application — and out to the team that shipped it.',
    stops: [
      { id: 'stk-dns-naming', note: 'A typed name is useless to routers — DNS walks its hierarchical namespace to turn it into an address.' },
      { id: 'stk-ip-routing', note: 'Packets head for that address hop by hop, each router moving them one step closer with no promises.' },
      { id: 'stk-tcp-udp', note: 'TCP builds a reliable, ordered stream out of those unreliable packets — acknowledgments and retransmission doing quiet work.' },
      {
        id: 'cry-tls-certificates',
        note: 'Twist into security: before any content moves, the handshake — a certificate proves the server’s name, and a session key is agreed.',
      },
      { id: 'cry-public-key-cryptography', note: 'The mathematics under that handshake: a key pair and a modular-arithmetic trapdoor make trust transferable.' },
      { id: 'web-http-rest', note: 'Back up the stack: over the secured stream, the browser finally speaks — a GET request, a status code, a body.' },
      { id: 'web-sockets-apis', note: 'On both ends, that conversation is just sockets: endpoints a program opens, writes, and reads.' },
      { id: 'app-authentication-authorization', note: 'The site knows who you are — a session token rides along, and authorization decides what this page will show you.' },
      {
        id: 'auto-deployment-monitoring',
        note: 'Final twist — the page exists because someone shipped it: a deploy put it here, and telemetry is watching this very request land.',
      },
    ],
  },
]
