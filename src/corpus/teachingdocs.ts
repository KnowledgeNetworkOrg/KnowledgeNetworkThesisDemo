// Hand-authored document bodies for every node in the CS TEACHING corpus —
// teaching micro-articles: what the topic is, why it matters, and how it
// connects. Bodies describe terrain, not narrative: a body may say what a
// topic's own role is (e.g. "the first rung of the ladder"), but never
// references any walk's sequence. Walk order and story live in
// `teachingwalks.ts`, not here.
//
// The deep layers below the topics carry one-line blurbs, authored next to
// their structure in deep.ts; `docs.ts` merges those in and runs the guard that
// every node has a body. This file is only the authored prose.

export const TEACHING_DOC: Record<string, string> = {
  // ── Root ────────────────────────────────────────────────────────────────
  root:
    'Computer Science — the whole field this map describes, from electrons pushed through ' +
    'transistors up to the practices teams use to ship software. Six domains, each teachable on ' +
    'its own, none actually independent: the links between them are where the understanding lives.',

  // ── Domains ─────────────────────────────────────────────────────────────
  sys:
    'Computer Systems — the bottom-up ladder from physics to a running program: digital logic ' +
    'builds circuits, circuits become a machine with an instruction set, and the operating system ' +
    'turns that one machine into the illusion of many.',
  math:
    'Mathematical Foundations — the discrete core (logic, sets, graphs, counting, induction) and ' +
    'its applied wing (probability, linear algebra, modular arithmetic). Almost nothing else on ' +
    'this map can be understood rigorously without something from here.',
  cs:
    'Core Computer Science — how data is organized, how efficiently it can be processed, and how ' +
    'languages themselves are built. The classic algorithmic heart of the field.',
  net:
    'Networking — how independent machines agree to move bytes: the protocol stack from wire to ' +
    'name resolution, and the web built on top of it.',
  sec:
    'Security — cryptography as mathematics made load-bearing, and the applied side: proving who ' +
    'you are, and the standard ways systems get broken.',
  se:
    'Software Engineering — the practices, testing discipline, and tooling that turn code that ' +
    'works once on one machine into software a team can change safely for years.',

  // ── Modules: Computer Systems ───────────────────────────────────────────
  dig: 'Digital Logic — how bits are represented and how transistor-built gates compose into circuits that compute and, with feedback, remember.',
  arc: 'Machine Organization — the contract between hardware and software: what instructions exist, and where code and data actually live at what speed.',
  os: 'Operating Systems — the software that multiplexes one machine into many programs: processes, scheduling, memory illusions, files, and the perils of doing things at the same time.',

  // ── Modules: Mathematical Foundations ───────────────────────────────────
  dm: 'Discrete Mathematics — the math of countable structure: logic, sets, graphs, counting, and proof by induction. The native mathematics of computing.',
  am: 'Applied Mathematics — the parts of continuous and number-theoretic math computing leans on hardest: probability, linear algebra, and modular arithmetic.',

  // ── Modules: Core Computer Science ──────────────────────────────────────
  ds: 'Data Structures — the standard shapes data is kept in, each a different bargain between lookup, insertion, ordering, and memory.',
  alg: 'Algorithms — how to measure the cost of a computation, and the classic strategies (sorting, traversal, dynamic programming) that keep costs civilized.',
  pl: 'Languages & Compilers — languages as mathematical objects: what patterns can be recognized, how structure is parsed, what types promise, and how source becomes machine code.',

  // ── Modules: Networking ─────────────────────────────────────────────────
  stk: 'Protocol Stack — the layered agreements that move a byte across the world: frames on a wire, addresses and routes, reliable streams, and names humans can actually use.',
  web: 'Web & Services — the application layer most software lives in now: HTTP’s request/response grammar and the socket APIs programs use to speak it.',

  // ── Modules: Security ───────────────────────────────────────────────────
  cry: 'Cryptography — encryption, hashing, and the key-exchange machinery that composes them into secure channels. Trust, reduced to arithmetic.',
  app: 'Applied Security — security where it meets users and attackers: authentication, authorization, and the standard catalog of ways systems fail.',

  // ── Modules: Software Engineering ───────────────────────────────────────
  prc: 'Practices — the daily disciplines of team development: versioning every change, reviewing each other’s work, and sharing a vocabulary of design.',
  tst: 'Testing — the discipline of making software prove itself: fast unit checks, whole-path integration checks, and machine-generated adversarial inputs.',
  tool: 'Tooling — the developer’s instruments: the shell that automates everything, and the debuggers and profilers that make invisible behavior visible.',
  auto: 'Automation — the machinery that runs the other practices without being asked: integration on every change, deployment and monitoring after it.',

  // ── Topics: Digital Logic ───────────────────────────────────────────────
  'dig-binary-data-representation':
    'Everything a computer touches — numbers, text, pixels, instructions — is a finite pattern of ' +
    'bits, and this topic is the codebook: place value in base 2, two’s complement for negatives, ' +
    'floating point’s trade-offs, character encodings. Most "impossible" bugs (overflow, rounding, ' +
    'mojibake) are just this topic, unlearned. The first rung of the systems ladder.',
  'dig-transistors-logic-gates':
    'A transistor is a switch controlled by voltage; wire a few together and you get AND, OR, NOT — ' +
    'propositional logic you can hold. Gates are where mathematics stops being notation and starts ' +
    'being physics, and every layer above them inherits their honesty: a circuit cannot handwave.',
  'dig-combinational-circuits':
    'Compose gates with no memory and you get circuits whose outputs depend only on present inputs: ' +
    'adders, multiplexers, decoders — the arithmetic and plumbing of a processor. The design skill is ' +
    'decomposition: any truth table can be built, the question is how cheaply.',
  'dig-sequential-logic-memory':
    'Feed a circuit’s output back into itself and it can remember: flip-flops hold a bit, registers ' +
    'hold a word, and a clock decides when everything moves. State is what separates a calculator ' +
    'from a computer — and state machines built this way reappear, abstracted, all over the map.',

  // ── Topics: Machine Organization ────────────────────────────────────────
  'arc-instruction-set-architecture':
    'The ISA is the contract between hardware and software: the registers that exist, the ' +
    'instructions the machine will execute, how they are encoded in bits. Everything above it — ' +
    'compilers, operating systems, debuggers — ultimately speaks this language, and everything below ' +
    'it is free to change as long as the contract holds.',
  'arc-memory-hierarchy-caches':
    'Fast memory is small and expensive, big memory is slow, so machines stack them: registers, ' +
    'caches, RAM, disk — each layer pretending to be as big as the next and as fast as the previous. ' +
    'Locality is why the trick works, and performance work at every level of software is largely ' +
    'the art of not fighting this hierarchy.',

  // ── Topics: Operating Systems ───────────────────────────────────────────
  'os-processes-threads':
    'A process is a running program with its own memory and identity; threads are multiple streams ' +
    'of execution sharing one process’s memory. This is the unit the whole OS manages — what gets ' +
    'scheduled, what owns files, what crashes alone or together. The point where a static program ' +
    'becomes a living thing.',
  'os-cpu-scheduling':
    'More runnable threads than cores means someone must choose who runs now — and the choice shapes ' +
    'everything users feel: latency, fairness, throughput. Preemption, priorities, and the queues ' +
    'behind them; every "why is it slow under load" question eventually lands here.',
  'os-virtual-memory':
    'Every process believes it owns all of memory; the OS and hardware maintain that illusion by ' +
    'translating virtual addresses to physical ones page by page. Isolation, swapping, and ' +
    'copy-on-write all fall out of one mechanism — the most consequential lie a computer tells.',
  'os-file-systems':
    'Files and directories are an illusion built over raw blocks: the file system maps names to ' +
    'data, tracks who may touch what, and survives power loss halfway through a write. Its structures ' +
    'decide what is fast (append) and what is slow (a million tiny files) in every program above it.',
  'os-concurrency-synchronization':
    'The moment two threads share data, correctness stops being obvious: races, deadlocks, and ' +
    'ordering surprises appear that no single-threaded intuition predicts. Locks, atomics, and ' +
    'condition variables are the vocabulary of getting it right — and the hardest bugs on this map ' +
    'live here.',

  // ── Topics: Discrete Mathematics ────────────────────────────────────────
  'dm-propositional-logic':
    'True, false, AND, OR, NOT, implication — the smallest useful theory of truth. It is the direct ' +
    'blueprint for logic gates, the backbone of every proof, and the thing a condition in code ' +
    'actually is. Most of this map compiles down to propositions eventually.',
  'dm-set-theory-functions':
    'Collections, membership, and mappings between them — the vocabulary the rest of mathematics is ' +
    'phrased in. Types are sets of values, database queries are set operations, a function’s ' +
    'signature is a statement about sets. Unglamorous, and underneath everything.',
  'dm-graph-theory':
    'Vertices and edges: the mathematics of "things and connections between them". Networks, ' +
    'dependencies, state machines, social graphs, this very map — all one theory. Paths, cycles, ' +
    'connectivity, and trees as the graphs with no redundancy.',
  'dm-combinatorics-counting':
    'How many ways can something happen — permutations, combinations, the pigeonhole principle. ' +
    'Counting is the engine under probability and the reason algorithm analysis can say "n log n" ' +
    'with a straight face: complexity is counting steps you refuse to perform.',
  'dm-induction-recursion':
    'Prove it for the base case, prove each step preserves it, and you have proved it for infinity — ' +
    'induction is how finite reasoning covers unbounded structures. Recursion is the same idea ' +
    'running forward: solve the small case, build the big one out of it. Trees, recurrences, and ' +
    'divide-and-conquer are all this topic wearing different clothes.',

  // ── Topics: Applied Mathematics ─────────────────────────────────────────
  'am-probability-statistics':
    'The mathematics of uncertainty: distributions, expectation, independence, and what a sample can ' +
    'honestly tell you. Hash collisions, randomized algorithms, load estimates, and key-guessing odds ' +
    'are all probability questions — computing runs on random behavior more than it admits.',
  'am-linear-algebra':
    'Vectors, matrices, and the transformations between spaces. A graph is a matrix if you squint ' +
    '(adjacency), graphics is matrix multiplication, and modern machine learning is little else. The ' +
    'applied math with the highest ceiling on this map.',
  'am-modular-arithmetic':
    'Arithmetic that wraps around: clock math, formally the ring of integers mod n. It is why fixed-' +
    'width integers overflow the way they do, how hash functions fold big values into small tables, ' +
    'and — via the difficulty of undoing exponentiation mod a large number — the engine of public-key ' +
    'cryptography.',

  // ── Topics: Data Structures ─────────────────────────────────────────────
  'ds-arrays-lists':
    'The two primal layouts: contiguous memory you index in constant time, and linked cells you can ' +
    'splice without moving anything. Every other structure is built from these two moves, and their ' +
    'trade-off — locality versus flexibility — echoes up through caches, allocators, and APIs.',
  'ds-hash-tables':
    'Turn a key into an array index with a hash function and you get near-constant lookup — the ' +
    'closest thing programming has to a free lunch, paid for in collision handling and resize costs. ' +
    'The default dictionary in every language, and the reason "just use a map" is usually right.',
  'ds-trees-heaps':
    'Hierarchy as a data structure: binary search trees keep order queryable, heaps keep the extreme ' +
    'element on top, B-trees keep disks happy. Trees are the recursive structure par excellence — ' +
    'and they secretly implement half the systems on this map, from file directories to parsed ' +
    'programs.',
  'ds-graph-representations':
    'How an abstract graph becomes bytes: adjacency lists for sparse graphs, adjacency matrices for ' +
    'dense ones or for algebra. The representation decides which questions are cheap — neighbors of ' +
    'one vertex, or existence of one edge — before any algorithm runs a step.',

  // ── Topics: Algorithms ──────────────────────────────────────────────────
  'alg-complexity-big-o':
    'Big-O is the discipline of asking "how does cost grow as input grows" and refusing to be ' +
    'comforted by fast hardware. It sorts the possible from the hopeless before a line is written, ' +
    'and it is the shared language of every algorithm conversation on this map.',
  'alg-sorting-searching':
    'The classic first algorithms: binary search’s halving trick, and the sorting family from ' +
    'insertion to merge to quick to heap. Studied less because you will write them — you won’t — ' +
    'than because they are the cleanest specimens of algorithmic thinking under a cost model.',
  'alg-graph-traversal':
    'Breadth-first and depth-first search, and shortest paths on top of them: the systematic ways to ' +
    'visit everything a graph can reach. Dependency resolution, garbage collection, route finding, ' +
    'and web crawling are all the same two loops with different bookkeeping.',
  'alg-dynamic-programming':
    'When a problem’s optimal answer is built from optimal answers to its subproblems, solve each ' +
    'subproblem once and remember it. DP is induction turned into an engineering technique — ' +
    'the standard cure for exponential blowup in planning, matching, and counting problems.',

  // ── Topics: Languages & Compilers ───────────────────────────────────────
  'pl-regular-expressions-automata':
    'Regular expressions describe patterns; finite automata are the machines that recognize them — ' +
    'two notations for exactly the same class of languages. The theory says precisely what patterns ' +
    'a scanner can match (and why regex cannot parse nested brackets), and the state machines ' +
    'involved are sequential logic’s abstract twins.',
  'pl-grammars-parsing':
    'Grammars generate languages; parsers run the generation backwards, recovering structure from a ' +
    'flat string of characters. One rung up the Chomsky hierarchy from regular expressions — the rung ' +
    'where nesting becomes possible, which is why programming languages live here.',
  'pl-type-systems':
    'A type is a claim about a value, and a type system is machinery that checks the claims before ' +
    'the program runs. At its lightest, it catches typos; at its deepest, propositions-as-types makes ' +
    'a program and a proof the same object. The design space every language stakes a position in.',
  'pl-compilers-interpreters':
    'The bridge across the biggest abstraction gap on the map: human-readable source in, ' +
    'machine-executable instructions out. Scanning, parsing, type checking, optimization, code ' +
    'generation — a compiler is a pipeline of nearly every core-CS idea, applied to programs ' +
    'themselves.',

  // ── Topics: Protocol Stack ──────────────────────────────────────────────
  'stk-link-layer-ethernet':
    'The bottom of the stack: how bits become signals on an actual medium, framed with addresses and ' +
    'checksums so one machine can talk to its physical neighbors. Everything above assumes this layer ' +
    'works and never thinks about it — which is the whole point of layering.',
  'stk-ip-routing':
    'IP gives every machine an address and routers a shared job: get the packet one hop closer, with ' +
    'no promises about arrival or order. The internet as a graph being traversed live, route tables ' +
    'as its distilled paths — best-effort delivery as a deliberate design philosophy.',
  'stk-tcp-udp':
    'Two answers to unreliable delivery: TCP builds an ordered, reliable byte stream out of ' +
    'acknowledgments and retransmission; UDP sends datagrams and lets the application cope. The ' +
    'choice between them — guarantees versus latency — is the first real protocol design decision ' +
    'most engineers meet.',
  'stk-dns-naming':
    'The distributed directory that turns names into addresses, delegated zone by zone down a ' +
    'hierarchical namespace. Caching makes it fast, delegation makes it survivable, and its position ' +
    'at the start of nearly every connection makes it a favorite target and a famous single point of ' +
    'failure.',

  // ── Topics: Web & Services ──────────────────────────────────────────────
  'web-http-rest':
    'A text protocol of requests and responses — methods, URLs, status codes, headers — that turned ' +
    'out to be general enough to carry most of the world’s application traffic. REST is the ' +
    'discipline of using its verbs and resources as designed; the result is the lingua franca of ' +
    'service boundaries.',
  'web-sockets-apis':
    'The programmer’s handle on the network: sockets as endpoints you open, write, and read like ' +
    'files. Everything network-shaped in application code — servers, clients, connection pools, ' +
    'streaming — is this API plus discipline about blocking and concurrency.',

  // ── Topics: Cryptography ────────────────────────────────────────────────
  'cry-symmetric-encryption':
    'One shared key both locks and unlocks: block ciphers, modes of operation, and the bit-level ' +
    'mixing that makes ciphertext indistinguishable from noise. Fast enough to encrypt everything — ' +
    'its one hard problem is how two parties get the shared key in the first place.',
  'cry-public-key-cryptography':
    'The asymmetric trick that solved key distribution: a key pair where one half encrypts or ' +
    'verifies what only the other half can decrypt or sign. The mathematics is modular arithmetic ' +
    'with a trapdoor — easy one way, infeasible to reverse — and digital identity is built on it.',
  'cry-cryptographic-hashing':
    'A one-way fingerprint: any input to a fixed-size digest, infeasible to invert or to collide. ' +
    'Password storage, content addressing, integrity checks, and signatures all reduce to this ' +
    'primitive — cousin to the hash table’s hash, but with adversaries in the threat model.',
  'cry-tls-certificates':
    'The protocol that composes the whole cryptographic toolbox: certificates prove a public key ' +
    'belongs to a name, the handshake uses it to agree on a session key, symmetric encryption ' +
    'carries the data. The padlock in the browser is this topic, end to end — trust made routine.',

  // ── Topics: Applied Security ────────────────────────────────────────────
  'app-authentication-authorization':
    'Two questions systems must never confuse: who are you (authentication — passwords, tokens, ' +
    'multi-factor) and what may you do (authorization — roles, permissions, scopes). Most real-world ' +
    'breaches are one of these answered sloppily, which is why sessions and token design deserve ' +
    'more care than they usually get.',
  'app-common-vulnerabilities':
    'The standard catalog of ways software gets broken: injection, cross-site scripting, buffer ' +
    'overflows, broken access control. Each is an old, well-understood pattern that keeps recurring ' +
    'because the mistake is easy and the exploit is cheap — knowing the catalog is the floor for ' +
    'writing software that faces the world.',

  // ── Topics: Practices ───────────────────────────────────────────────────
  'prc-version-control':
    'A database of every version of the code and why it changed: commits, branches, merges, and the ' +
    'shared history a team reasons about. Beyond backup, it is the coordination medium of modern ' +
    'development — and its content-addressed internals are a small masterclass in applied hashing.',
  'prc-code-review':
    'A second pair of eyes on every change before it lands: part defect filter, part knowledge ' +
    'transfer, part enforcement of shared standards. The cheapest quality practice a team can adopt, ' +
    'and the main channel through which design judgment actually spreads.',
  'prc-design-patterns':
    'Named solutions to recurring design problems — observer, factory, visitor, strategy — a shared ' +
    'vocabulary for structure that would otherwise take paragraphs. The names matter more than the ' +
    'UML: they compress design conversations by an order of magnitude.',

  // ── Topics: Testing ─────────────────────────────────────────────────────
  'tst-unit-testing':
    'Small, fast, automated checks of one unit’s behavior in isolation — the tests you run hundreds ' +
    'of times a day without thinking. Their real product is not caught bugs but permission to ' +
    'change code fearlessly; a codebase without them calcifies.',
  'tst-integration-testing':
    'Tests that exercise real paths through multiple components — service to database, client to ' +
    'API — where the bugs unit tests structurally cannot see actually live: mismatched assumptions ' +
    'at the seams. Slower and flakier than unit tests, and irreplaceable for exactly that reason.',
  'tst-property-based-testing':
    'Instead of asserting one example, state a property that must hold for all inputs — then let the ' +
    'machine generate hundreds of adversarial cases and shrink each failure to its minimal form. ' +
    'Randomness turned into a testing instrument; it finds the cases no human would think to write.',

  // ── Topics: Tooling ─────────────────────────────────────────────────────
  'tool-shell-scripting':
    'The shell is process control made visible: spawn programs, wire their outputs to inputs, script ' +
    'the composition. Fluency here is a multiplier on everything else — one line of pipeline ' +
    'replacing an afternoon of clicking — and it is the substrate automation is built from.',
  'tool-debuggers-profilers':
    'The instruments that make running software observable: debuggers stop time to inspect state at ' +
    'a breakpoint; profilers measure where time and memory actually go, which is reliably not where ' +
    'anyone guessed. The difference between debugging by evidence and debugging by superstition.',

  // ── Topics: Automation ──────────────────────────────────────────────────
  'auto-continuous-integration':
    'Every change is built and tested by a machine before it merges — the team’s test suites and ' +
    'checks running as an impartial gate, not a personal discipline. CI converts "it works on my ' +
    'machine" from an argument into an impossibility.',
  'auto-deployment-monitoring':
    'Shipping as a routine, observed activity: automated deploys that can roll back, and telemetry — ' +
    'errors, latency, saturation — watching production afterward. The feedback loop that closes the ' +
    'engineering cycle: code is not done when it merges, it is done when it behaves in the world.',

}
