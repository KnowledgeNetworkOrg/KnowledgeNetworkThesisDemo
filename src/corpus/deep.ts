// The deep layers of the CS teaching corpus: hand-authored subtopics BELOW
// the 53 edge-bearing topics in graph.ts. Pure data — graph.ts attaches these
// under each topic (ids chain parent-id + title slug) and merges the `d`
// blurbs into the document bodies. Typed edges never reach down here: depth
// is containment only, which is exactly what the vertical instruments
// (tree, drill, cockpit) disclose.
//
// Shape: every topic gets 2–4 subtopics (level 5); EVERY subtopic decomposes
// into at least two concepts (level 6 — the depth floor, so no branch dies at
// 5); every topic's subtree reaches level 7 somewhere; and ONE flagship spine
// per domain reaches level 8 — ragged at the tips on purpose, because real
// curricula are. The six spines:
//   sys  Virtual Memory → Paging → Page Tables → Multi-Level → x86-64 Walk
//   math Graph Theory → Spanning Structures → MSTs → Cut & Cycle → Exchange
//   cs   Sorting & Searching → Comparison Sorts → Quicksort → Partitioning → Lomuto vs. Hoare
//   net  TCP & UDP → Congestion Control → Loss-Based → CUBIC → Window Growth
//   sec  Public-Key → RSA → Key Generation → Prime Selection → Miller–Rabin
//   se   Version Control → Git Internals → Object Model → Packfiles → Delta Compression

// The shape lives in corpusbuild.ts now — both corpora author deep layers the
// same way, so there is one definition of what a layer is.
export type { DeepSpec } from './graphshape'
import type { DeepSpec } from './graphshape'

/** children of each topic, keyed by the topic's id in graph.ts */
export const DEEP: Record<string, Record<string, DeepSpec>> = {
  // ═══ sys · Digital Logic ═══════════════════════════════════════════════
  'dig-binary-data-representation': {
    'Number Bases & Integers': {
      d: 'Positional notation in bases 2, 8, and 16 — and how a fixed-width word turns "number" into a finite resource.',
      c: {
        "Two's Complement": {
          d: 'One encoding for signed integers where subtraction is just addition — the reason hardware needs only one adder.',
          c: {
            'Sign Extension': { d: 'Widening a signed value copies the top bit leftward — forget it and negative numbers silently become huge positives.' },
            'The Asymmetric Range': { d: 'One more negative value than positive: negating the minimum overflows back to itself, a corner case that has crashed real systems.' },
          },
        },
        'Overflow & Wraparound': { d: 'Fixed-width arithmetic is modular: past the top value, numbers silently wrap unless something checks.' },
      },
    },
    'Floating Point': {
      d: 'Real numbers faked in 32 or 64 bits: a sign, an exponent, and a fraction trading range against precision.',
      c: {
        'IEEE 754 Layout': { d: 'The universal bit split — sign, biased exponent, mantissa — plus the special citizens: zeros, infinities, NaN.' },
        'Rounding & Precision Loss': { d: 'Why 0.1 + 0.2 ≠ 0.3: most decimals have no exact binary form, and every operation rounds.' },
      },
    },
    'Text Encodings': {
      d: 'How characters become bytes, and why "plain text" never is.',
      c: {
        'ASCII & Code Pages': { d: 'Seven bits for English, then a decade of mutually incompatible 8-bit extensions for everyone else.' },
        'Unicode & UTF-8': { d: 'One code point per character, and a variable-width encoding that keeps every old ASCII file valid byte-for-byte.' },
      },
    },
    'Bitwise Operations': {
      d: 'AND, OR, XOR, shifts — arithmetic on the representation itself, the idiom layer of low-level code.',
      c: {
        'Masks & Flags': { d: 'Pack booleans into one word and test them with AND — the layout trick behind permission bits and option flags.' },
        'Shifts as Arithmetic': { d: 'Left shift multiplies by two, right shift divides — with the signed/unsigned distinction deciding what slides in from the top.' },
      },
    },
  },
  'dig-transistors-logic-gates': {
    'MOSFET Switching': {
      d: 'A voltage on the gate opens or closes a channel — the physical event every computation ultimately reduces to.',
      c: {
        'Threshold Voltage': { d: 'The gate voltage where the channel opens — below it the transistor is almost off, and "almost" is where leakage lives.' },
        'Propagation Delay': { d: 'Gates take time to settle; the longest chain of delays sets the clock speed the whole chip can run at.' },
      },
    },
    'Basic Gates': {
      d: 'AND, OR, NOT and their combinations: the vocabulary boolean formulas are built from in silicon.',
      c: {
        'NAND as Universal Gate': {
          d: 'Every boolean function can be built from NAND alone — one manufacturable part, all of logic.',
          c: {
            'Functional Completeness': { d: 'A gate set is complete when it can express every truth table — {NAND} alone qualifies, and the proof is three small constructions.' },
          },
        },
        'Fan-In & Fan-Out': { d: 'How many inputs a gate can take and how many gates its output can drive — the electrical limits on composing logic freely.' },
      },
    },
    'CMOS & Power': {
      d: 'Complementary transistor pairs that draw power mainly while switching — why heat scales with clock speed.',
      c: {
        'Complementary Pairs': { d: 'Every CMOS gate is a pull-up network of p-transistors mirrored by a pull-down of n-transistors — exactly one side conducts at rest.' },
        'Dynamic vs. Static Power': { d: 'Switching burns charge per transition; leakage burns it constantly — shrinking transistors traded one problem for the other.' },
      },
    },
  },
  'dig-combinational-circuits': {
    Adders: {
      d: 'Circuits that add: the schoolbook carry chain, then cleverness to stop waiting for it.',
      c: {
        'Ripple-Carry Adder': { d: 'Full adders chained bit by bit — simple, small, and slow in proportion to the word width.' },
        'Carry-Lookahead': {
          d: 'Compute all carries in parallel from generate/propagate signals — logarithmic depth bought with more gates.',
          c: {
            'Generate & Propagate': { d: 'Each bit position either creates a carry, passes one along, or kills it — recasting addition as a parallel prefix problem.' },
          },
        },
      },
    },
    'Multiplexers & Decoders': {
      d: 'The traffic control of circuits: select one input among many, or turn a binary index into one active line.',
      c: {
        'Mux as Universal Logic': { d: 'Wire a truth table onto a mux and the selector computes the function — lookup tables are muxes, and FPGAs are lookup tables.' },
        'Address Decoding': { d: 'A decoder turns an address into one active chip-select line — how a flat address space maps onto separate physical devices.' },
      },
    },
    'ALU Design': {
      d: 'One circuit, many operations — add, subtract, compare, and logic sharing hardware behind a mode selector.',
      c: {
        'Operation Select': { d: 'Compute every candidate result in parallel and let a mux pick the one the opcode asked for — silicon spent, latency saved.' },
        'Flags & Condition Codes': { d: 'Zero, negative, carry, overflow — four bits summarizing the last result, and the entire basis of conditional branching.' },
      },
    },
  },
  'dig-sequential-logic-memory': {
    'Latches & Flip-Flops': {
      d: 'Feedback loops that hold a bit; the clock decides when they are allowed to change.',
      c: {
        'SR Latch': { d: 'Two cross-coupled gates and the first bit of memory — plus the forbidden state that teaches why timing matters.' },
        'D Flip-Flop & Clock Edges': {
          d: 'Capture the input exactly at the clock edge, ignore it otherwise — the building block of every register.',
          c: {
            'Setup & Hold Times': { d: 'The input must be stable just before and just after the clock edge — violate the window and the flip-flop may capture garbage.' },
            Metastability: { d: 'Sample a changing signal and the output can hover between 0 and 1 — unavoidable in principle, managed with synchronizer chains.' },
          },
        },
      },
    },
    'Finite State Machines': {
      d: 'A state register plus next-state logic: the pattern behind controllers, protocols, and regex engines alike.',
      c: {
        'Moore vs. Mealy': { d: 'Outputs from state alone, or from state plus input — Mealy reacts a cycle earlier with fewer states, Moore outputs glitch less.' },
        'State Encoding': { d: 'One-hot, binary, Gray — how states map to flip-flop bits trades register count against decode logic and glitch safety.' },
      },
    },
    'Registers & Counters': {
      d: 'Flip-flops in formation — a word of fast storage, or a value that steps with every clock tick.',
      c: {
        'Shift Registers': { d: 'Bits march one place per clock — serial-to-parallel conversion, delay lines, and the guts of every UART.' },
        'Ripple vs. Synchronous Counters': { d: 'Chain the clocks and carries ripple slowly; share one clock and all bits flip together — the ripple-carry trade again.' },
      },
    },
    'SRAM & DRAM Cells': {
      d: 'Six transistors holding a bit as long as power lasts, or one transistor and a leaking capacitor refreshed forever.',
      c: {
        'The 6T Cell': { d: 'Two cross-coupled inverters holding each other steady plus two access transistors — fast, stable, and six times the area of DRAM.' },
        'Refresh Cycles': { d: 'DRAM capacitors leak, so every row must be read and rewritten every few milliseconds — memory that forgets unless reminded.' },
      },
    },
  },

  // ═══ sys · Machine Organization ════════════════════════════════════════
  'arc-instruction-set-architecture': {
    'Instruction Encoding': {
      d: 'Opcodes and operand fields packed into bit layouts — the machine grammar frozen so software survives new hardware.',
      c: {
        'Fixed vs. Variable Length': { d: 'Every instruction four bytes, or one to fifteen — uniform decode against code density, RISC and x86 staking opposite claims.' },
        'Register Fields': { d: 'Five bits name one of thirty-two registers — why register counts are powers of two and adding one more means finding bits nobody has.' },
      },
    },
    'Addressing Modes': {
      d: 'The ways an operand can say where its data lives: register, immediate, memory, and indexed combinations.',
      c: {
        'Base + Displacement': { d: 'A register plus a small constant — the mode struct field access and stack variables compile down to.' },
        'PC-Relative Addressing': { d: 'Address data by its distance from the instruction itself — the trick that makes code loadable anywhere.' },
      },
    },
    'RISC vs. CISC': {
      d: 'Few simple uniform instructions versus many powerful irregular ones — a design argument the market settled from both ends.',
      c: {
        'Load-Store Architectures': { d: 'Arithmetic touches only registers; memory is reached through explicit loads and stores — the discipline that makes pipelining clean.' },
        Microcode: { d: 'Complex instructions decomposed inside the chip into simpler micro-ops — CISC outside, RISC within, and how x86 survived its own ISA.' },
      },
    },
    'Calling Conventions': {
      d: 'The contract for function calls: who saves which registers, where arguments go, how the stack is shaped.',
      c: {
        'Stack Frames': {
          d: 'Each call pushes a frame — return address, saved registers, locals — and the debugger walks them back out.',
          c: {
            'Frame Pointers': { d: 'A register anchoring the current frame so locals have fixed offsets — reclaimed as a general register once unwind tables replace it.' },
            'Stack Unwinding': { d: 'Walking frames backward through return addresses — how debuggers print backtraces and exceptions find their handlers.' },
          },
        },
        'Argument Passing': { d: 'The first few arguments ride in registers, the overflow goes on the stack — fixed per platform by the ABI.' },
      },
    },
  },
  'arc-memory-hierarchy-caches': {
    'Locality of Reference': {
      d: 'Programs revisit recent data and march through neighbors — the two statistical habits the whole hierarchy is a bet on.',
      c: {
        'Temporal Locality': { d: 'What was touched recently will be touched again — the bet behind keeping recent data cached at all.' },
        'Spatial Locality': { d: 'What sits next to touched data gets touched next — the bet behind fetching whole cache lines instead of single words.' },
      },
    },
    'Cache Organization': {
      d: 'How a small fast memory decides which slice of a big slow one it currently mirrors.',
      c: {
        'Direct-Mapped Caches': { d: 'Every address has exactly one slot — trivially fast to check, embarrassingly easy to thrash.' },
        'Set Associativity': {
          d: 'A few candidate slots per address: most of fully-associative hit rates at a fraction of the hardware.',
          c: {
            'Tag, Index & Offset': { d: 'One address split three ways: which set to search, which line matches, which byte inside — cache lookup is bit slicing.' },
            'Conflict Misses': { d: 'Addresses sharing an index evict each other while the rest of the cache sits idle — the miss class associativity exists to reduce.' },
          },
        },
        'Replacement Policies': { d: 'When the set is full, something must go — LRU and its cheaper approximations pick the victim.' },
      },
    },
    'Cache Coherence': {
      d: 'Multiple cores, private caches, one memory: the protocols that keep every core seeing the same story.',
      c: {
        'MESI States': { d: 'Modified, Exclusive, Shared, Invalid — four states per cache line, and every core agreeing on who may write.' },
        'False Sharing': { d: 'Two cores writing different variables that share one cache line — no logical conflict, yet the line ping-pongs and performance dies.' },
      },
    },
    'Storage Tiers': {
      d: 'SSDs and disks as the vast, slow bottom of the hierarchy — same locality bet, milliseconds instead of nanoseconds.',
      c: {
        'Flash & Wear Leveling': { d: 'Flash cells endure limited writes, so the controller scatters them — the firmware bookkeeping hiding inside every SSD.' },
        'The Latency Gap': { d: 'Nanoseconds to RAM, microseconds to SSD, milliseconds to disk — three orders of magnitude that shape every design above them.' },
      },
    },
  },

  // ═══ sys · Operating Systems ═══════════════════════════════════════════
  'os-processes-threads': {
    'Process Lifecycle': {
      d: 'Created, ready, running, blocked, dead — and the queues a process waits in between those states.',
      c: {
        'Process States': { d: 'Ready, running, blocked — and the transitions only the scheduler or an awaited event may trigger.' },
        'Zombies & Orphans': { d: 'A dead child lingers until its parent collects the exit status; orphans get adopted by init — bookkeeping, not horror.' },
      },
    },
    'Context Switching': {
      d: 'Freeze one computation mid-instruction, thaw another: register state swapped in microseconds, the illusion of many machines.',
      c: {
        'What Gets Saved': { d: 'Registers, program counter, stack pointer — the CPU-visible state; caches and TLB contents stay behind and pay later.' },
        'Switch Overhead': { d: 'The direct cost is microseconds; the indirect cost is cold caches afterward — why thread pools exist and spinlocks sometimes win.' },
      },
    },
    'Threads vs. Processes': {
      d: 'Threads share an address space, processes own one — the difference between cheap cooperation and enforced isolation.',
      c: {
        'Shared Address Spaces': { d: 'Threads see each other’s writes instantly — free communication and free data races, the same feature twice.' },
        'User vs. Kernel Threads': { d: 'Scheduled by a runtime library or by the kernel — M:N mappings, goroutines, and who notices when one blocks.' },
      },
    },
    'System Calls': {
      d: 'The narrow doorway where a program asks the kernel for anything real: files, memory, network, more processes.',
      c: {
        'User/Kernel Boundary': {
          d: 'Two privilege worlds on one CPU — code crosses only through controlled gates, never by jumping.',
          c: {
            'Privilege Rings': { d: 'Hardware-enforced modes deciding which instructions and addresses are legal — the kernel is just code running in the trusted one.' },
            'The Syscall Instruction': { d: 'One instruction that jumps to a fixed kernel entry point and raises privilege atomically — the only legal door in.' },
          },
        },
        'Traps & Interrupts': { d: 'The mechanisms that yank the CPU into the kernel: deliberately (syscalls), accidentally (faults), or externally (devices).' },
      },
    },
  },
  'os-cpu-scheduling': {
    'Scheduling Metrics': {
      d: 'Throughput, latency, fairness — the goals that pull in different directions, so every scheduler picks a side.',
      c: {
        'Turnaround vs. Response Time': { d: 'Finish batch jobs fast, or acknowledge interactive ones instantly — optimizing either metric degrades the other.' },
        'Fairness & Starvation': { d: 'A policy can be optimal on average while one job waits forever — starvation is the failure fairness metrics exist to catch.' },
      },
    },
    'Classic Policies': {
      d: 'The standard answers to "who runs next", each optimizing a different metric.',
      c: {
        'Round-Robin': { d: 'Everyone gets a time slice in turn — fairness by clock, at the cost of context-switch overhead.' },
        'Priority & Aging': { d: 'Important work first, with priorities that drift upward while waiting so nothing starves forever.' },
        'Multi-Level Feedback Queues': {
          d: 'Demote CPU hogs, promote interactive jobs — the scheduler learns behavior instead of being told.',
          c: {
            'Demotion & Boosting': { d: 'Use your whole slice, sink a level; wait too long, rise again — behavior-based priority with a periodic reset to keep it honest.' },
          },
        },
      },
    },
    'Real-Time Scheduling': {
      d: 'When "usually fast" is failure: deadline-driven policies that guarantee timing or refuse the work.',
      c: {
        'Earliest Deadline First': { d: 'Always run the task whose deadline is nearest — optimal on one processor, catastrophic past full load.' },
        'Admission Control': { d: 'Refuse work that would break existing guarantees — real-time systems say no at arrival time, not at deadline time.' },
      },
    },
  },
  'os-virtual-memory': {
    'Address Translation': {
      d: 'Every memory reference a program makes is a fiction the hardware translates on the fly — per process, per access.',
      c: {
        'Virtual vs. Physical Addresses': { d: 'The program sees one clean space starting at zero; the hardware sees frames scattered anywhere — translation is the illusion’s engine.' },
        'Protection Bits': { d: 'Read, write, execute — per-page permissions checked on every access, and the reason a wild pointer faults instead of corrupting.' },
      },
    },
    Paging: {
      d: 'Memory chopped into fixed-size pages: no external fragmentation, and a clean unit for translation, protection, and eviction.',
      c: {
        'Page Tables': {
          d: 'The per-process map from virtual page to physical frame, consulted (in effect) on every single access.',
          c: {
            'Multi-Level Page Tables': {
              d: 'A tree of tables instead of one flat array — sparse address spaces pay only for the branches they touch.',
              c: {
                'x86-64 Four-Level Walk': { d: 'PML4 → PDPT → PD → PT: nine bits of the address per level, one physical read each — the walk the TLB exists to skip.' },
              },
            },
          },
        },
        TLBs: { d: 'A tiny cache of recent translations — the only reason paging is affordable at all.' },
      },
    },
    'Page Replacement': {
      d: 'When physical memory is full, some page must leave — choosing which is a bet on the future.',
      c: {
        'Working Sets': { d: 'The pages a process actually needs right now; keep those resident and it barely notices paging exists.' },
        'Clock Algorithm': { d: 'LRU is too expensive to track exactly, so a sweeping hand and one reference bit approximate it well enough.' },
      },
    },
    'Swapping & Thrashing': {
      d: 'Overcommit too far and the system spends its life moving pages instead of running programs.',
      c: {
        'Swap Space': { d: 'Disk pressed into service as overflow memory — pages evicted wholesale, addresses intact, speed sacrificed.' },
        'Detecting Thrash': { d: 'When page faults dominate runtime the fix is fewer processes, not better eviction — load shedding at the memory level.' },
      },
    },
  },
  'os-file-systems': {
    'Files & Metadata': {
      d: 'A file is bytes plus bookkeeping — size, owner, permissions, timestamps — and the name is not part of it.',
      c: {
        'File Descriptors': { d: 'Small integers naming open files per process — capabilities in disguise, inherited across fork, multiplexed by select.' },
        'Permission Bits': { d: 'Owner, group, other × read, write, execute — nine bits of access control that have outlived every richer scheme beside them.' },
      },
    },
    'Directories & Paths': {
      d: 'Directories are just files mapping names to file numbers; a path is a walk through that map.',
      c: {
        'Hard & Symbolic Links': { d: 'Two names for one inode, or a file containing a path — one survives deletion of the original, the other dangles.' },
        'Path Resolution': { d: 'Each slash is a directory lookup with permissions checked at every step — one open() can be a dozen reads.' },
      },
    },
    'Allocation & Layout': {
      d: 'Where file bytes physically live, and how the system finds block N without reading blocks 0 through N−1.',
      c: {
        'Inodes & Extents': {
          d: 'Per-file index structures: block pointers for small files, contiguous extents when the disk can offer them.',
          c: {
            'Indirect Blocks': { d: 'Pointers to blocks of pointers — the classic trick that lets a fixed-size inode address terabytes, at logarithmic cost.' },
            'Extent Trees': { d: 'Store (start, length) runs instead of block lists — contiguous files described in one entry, fragmented ones in a tree.' },
          },
        },
        'Free-Space Management': { d: 'Bitmaps or free lists tracking which blocks are unclaimed — allocation speed and fragmentation both start here.' },
      },
    },
    'Journaling & Crash Consistency': {
      d: 'Write the intention before the change, so a crash mid-operation replays or rolls back — never half-happens.',
      c: {
        'Write-Ahead Logging': { d: 'Append the intended change to a log, flush, then apply — replay after a crash makes multi-block updates atomic.' },
        'Copy-on-Write File Systems': { d: 'Never overwrite live data; write new versions and flip a root pointer — snapshots become free and crashes harmless.' },
      },
    },
  },
  'os-concurrency-synchronization': {
    'Race Conditions': {
      d: 'Two threads, one variable, no coordination: the outcome depends on timing you cannot see or reproduce.',
      c: {
        Interleavings: { d: 'Two threads of n steps have astronomically many schedules — testing samples a few, the bug lives in one.' },
        'Atomic Operations': { d: 'Compare-and-swap and friends — hardware-guaranteed indivisible steps, the bedrock every lock is built on.' },
      },
    },
    'Locks & Mutual Exclusion': {
      d: 'Make the critical section one-at-a-time and the race disappears — along with some parallelism.',
      c: {
        Semaphores: {
          d: 'A counter with atomic wait/signal — mutual exclusion, resource pools, and signaling in one primitive.',
          c: {
            'Producer–Consumer': { d: 'Two semaphores counting full and empty slots — the canonical pattern that makes bounded buffers safe without busy-waiting.' },
          },
        },
        'Spinlocks vs. Blocking': { d: 'Burn CPU waiting, or pay a context switch to sleep — the right answer depends on how long the wait is.' },
      },
    },
    Deadlock: {
      d: 'Everyone holds something and waits for someone else — the system is perfectly consistent and perfectly stuck.',
      c: {
        'The Four Conditions': { d: 'Mutual exclusion, hold-and-wait, no preemption, circular wait: break any one and deadlock is impossible.' },
        'Lock Ordering': { d: 'Acquire locks in one global order and circular wait becomes impossible — the cheapest of the four conditions to break.' },
      },
    },
    'Memory Ordering': {
      d: 'Compilers and CPUs reorder your reads and writes; without fences, other threads may see a history that never happened.',
      c: {
        'Memory Barriers': { d: 'Instructions that forbid reordering across themselves — the fence posts locks and lock-free code are built between.' },
        'Sequential Consistency': { d: 'The intuitive model — all threads see one global interleaving — and the one real hardware refuses to give you by default.' },
      },
    },
  },

  // ═══ math · Discrete Mathematics ═══════════════════════════════════════
  'dm-propositional-logic': {
    'Connectives & Truth Tables': {
      d: 'AND, OR, NOT, IMPLIES — meaning defined exhaustively, one row per possible world.',
      c: {
        'Implication & Vacuous Truth': { d: 'False implies anything — the table entry that feels wrong until empty-case proofs depend on it.' },
        'Tautologies & Contradictions': { d: 'True in every row, false in every row — and everything between is called contingent.' },
      },
    },
    'Equivalence & Normal Forms': {
      d: 'Different formulas, same truth table — and standard shapes every formula can be rewritten into.',
      c: {
        "De Morgan's Laws": { d: 'Negation distributes by flipping the connective — the little identity doing heavy lifting in code and proofs alike.' },
        'CNF & DNF': {
          d: 'ANDs of ORs, or ORs of ANDs: canonical forms that make formulas comparable and SAT solvers possible.',
          c: {
            'Conversion Blowup': { d: 'Distributing ORs over ANDs can square the formula at each step — normal forms always exist, but reaching them can cost exponentially.' },
            SAT: { d: 'Is any row of the truth table true? The first NP-complete problem, and the engine modern verification tools are built on.' },
          },
        },
      },
    },
    'Rules of Inference': {
      d: 'Modus ponens and friends — the legal moves that carry truth from premises to conclusion.',
      c: {
        'Modus Ponens & Tollens': { d: 'From "if P then Q": affirm P to get Q, deny Q to refute P — and the two famous fallacies that reverse them.' },
        'Proof by Contradiction': { d: 'Assume the opposite, derive the absurd — logic’s oldest indirect route, and constructivists’ oldest complaint.' },
      },
    },
    'Predicates & Quantifiers': {
      d: 'For-all and there-exists turn statements about one thing into statements about domains — where real math begins.',
      c: {
        'Quantifier Order': { d: '"Everyone loves someone" versus "someone is loved by everyone" — swapping ∀ and ∃ changes the claim entirely.' },
        'Negating Quantifiers': { d: 'Not-for-all is exists-a-counterexample — pushing negation inward flips each quantifier it passes.' },
      },
    },
  },
  'dm-set-theory-functions': {
    'Set Operations & Algebra': {
      d: 'Union, intersection, complement, difference — and the algebra of identities they obey.',
      c: {
        'Power Sets': { d: 'The set of all subsets — 2ⁿ members, and the launchpad of the proof that infinities stack.' },
        'Cartesian Products': { d: 'All ordered pairs from two sets — where coordinates, relations, and database joins are all born.' },
      },
    },
    Relations: {
      d: 'Subsets of pairs: the mathematical form of "is connected to", "is less than", "is equivalent to".',
      c: {
        'Equivalence Relations': { d: 'Reflexive, symmetric, transitive — and every one of them is secretly a partition into classes.' },
        'Partial Orders': {
          d: 'Some pairs comparable, some not: the shape of dependency, inheritance, and every DAG you will ever draw.',
          c: {
            'Hasse Diagrams': { d: 'Draw only the covering relations and let height imply the rest — the readable picture of a partial order.' },
            'Chains & Antichains': { d: 'Totally comparable subsets versus mutually incomparable ones — the two extremes a partial order is measured by.' },
          },
        },
      },
    },
    'Functions & Mappings': {
      d: 'Relations where every input gets exactly one output — the arrows all of mathematics is drawn with.',
      c: {
        'Injections, Surjections, Bijections': { d: 'No collisions, full coverage, or both — the three ways a mapping can be well-behaved.' },
        'Composition & Inverses': { d: 'Chain functions output-to-input; invert exactly the bijections — the algebra programs and proofs share.' },
      },
    },
    'Cardinality & Infinity': {
      d: 'Comparing sizes by pairing elements off — with the shock that infinities come in different sizes.',
      c: {
        Countability: { d: 'A set is countable if the naturals can enumerate it — rationals yes, and that is already surprising.' },
        Diagonalization: { d: 'Assume the list is complete, build the element it must have missed — the argument behind uncountability and the halting problem.' },
      },
    },
  },
  'dm-graph-theory': {
    'Graphs & Degree': {
      d: 'Vertices, edges, and the first theorem everyone proves: degrees sum to twice the edge count.',
      c: {
        'The Handshake Lemma': { d: 'Degrees sum to twice the edges, so odd-degree vertices come in pairs — counting one thing two ways, the field’s favorite move.' },
        'Degree Sequences': { d: 'Sort the degrees and ask which lists are realizable — the first fingerprint for telling graphs apart.' },
      },
    },
    'Paths & Connectivity': {
      d: 'When can you get there from here — and what it takes to disconnect a graph.',
      c: {
        'Euler & Hamilton Paths': { d: 'Cross every edge once (easy to decide) versus visit every vertex once (NP-hard) — near-twins, opposite difficulty.' },
        'Cut Vertices & Bridges': { d: 'The single points whose removal disconnects the graph — where networks are fragile, and DFS finds them in linear time.' },
      },
    },
    'Trees & Spanning Structures': {
      d: 'Connected, acyclic, minimal: trees are the skeletons of graphs, and every connected graph contains one.',
      c: {
        'Rooted Trees & Forests': { d: 'Pick a root and every edge gains direction for free — the graph theorist’s tree becomes the programmer’s.' },
        'Minimum Spanning Trees': {
          d: 'The cheapest skeleton that still connects everything — and greedy algorithms provably find it.',
          c: {
            'Cut & Cycle Properties': {
              d: 'The lightest edge across any cut belongs to an MST; the heaviest edge on any cycle does not — two lemmas that power every MST algorithm.',
              c: {
                'The Exchange Argument': { d: 'Swap a tree edge for a better one and stay a spanning tree — the proof move that turns greedy from plausible into correct.' },
              },
            },
          },
        },
      },
    },
    'Coloring & Planarity': {
      d: 'Which graphs can be drawn without crossings, and how few colors a map really needs — where graph theory meets geometry.',
      c: {
        'The Four-Color Theorem': { d: 'Every planar map needs at most four colors — proved with unavoidable configurations and a computer, to lasting philosophical grumbling.' },
        "Euler's Formula": { d: 'V − E + F = 2 for planar graphs — one line of arithmetic that forbids K₅ from ever lying flat.' },
      },
    },
  },
  'dm-combinatorics-counting': {
    'Counting Principles': {
      d: 'Multiply independent choices, add disjoint cases — and two famous corollaries that punch above their weight.',
      c: {
        'Pigeonhole Principle': { d: 'More pigeons than holes means a shared hole — trivial to state, weirdly powerful in proofs.' },
        'Inclusion–Exclusion': {
          d: 'Add the sets, subtract the overlaps, add back the over-subtractions — counting unions exactly.',
          c: {
            Derangements: { d: 'Permutations with no fixed point — counted by inclusion–exclusion, converging on n!/e as if probability had been invited.' },
          },
        },
      },
    },
    'Permutations & Combinations': {
      d: 'Ordered arrangements versus unordered selections — the two workhorse counts.',
      c: {
        'Binomial Coefficients': { d: 'n-choose-k: one number that shows up in counting, algebra, and probability, tied together by Pascal’s triangle.' },
        'Stars and Bars': { d: 'Distribute identical items into distinct boxes by arranging separators — the bijection that turns hard counts into n-choose-k.' },
      },
    },
    'Recurrence Relations': {
      d: 'Define a count by smaller versions of itself — the bridge between combinatorics and algorithm analysis.',
      c: {
        'Linear Recurrences': { d: 'Fibonacci and kin — solved exactly via characteristic roots, the discrete cousin of differential equations.' },
        'Generating Functions': { d: 'Encode a counting sequence as a power series and multiply instead of summing — algebra doing combinatorics’ bookkeeping.' },
      },
    },
  },
  'dm-induction-recursion': {
    'Weak & Strong Induction': {
      d: 'Prove the base, prove the step, own all of the naturals — with the strong form assuming everything below.',
      c: {
        'The Induction Hypothesis': {
          d: 'What exactly you may assume at step n — too weak and the step fails, and the fix is strengthening the claim itself.',
          c: {
            'Strengthening the Hypothesis': { d: 'Prove MORE than asked and the inductive step gains leverage — the paradox that a stronger theorem can be easier.' },
          },
        },
        'Base-Case Pitfalls': { d: 'The induction proving all horses one color — a flawless step leaning on a base case that never covered n = 2.' },
      },
    },
    'Structural Induction': {
      d: 'Induction over trees, lists, and grammars instead of numbers — the proof technique native to computer science.',
      c: {
        'Induction on Trees': { d: 'Assume the property for subtrees, prove it for the node — how facts about heights, balance, and traversals actually get proved.' },
        'Induction on Grammars': { d: 'One proof case per production rule — the technique type-soundness and compiler-correctness proofs run on.' },
      },
    },
    'Recursive Definitions': {
      d: 'Objects defined by smaller selves — legitimate exactly when something gets smaller every step.',
      c: {
        'Well-Founded Recursion': { d: 'Legal exactly when every call chain descends a well-ordered measure — why "smaller" must be defined before "recursive" is.' },
        'Mutual Recursion': { d: 'Functions defined through each other — terminating together or not at all, proved by one shared measure.' },
      },
    },
    'Loop Invariants': {
      d: 'A property true before and after every iteration — induction wearing work clothes, proving loops correct.',
      c: {
        'The Three Obligations': { d: 'True at entry, preserved by the body, useful at exit — initialization, maintenance, termination, checked like a ritual.' },
        'Termination Measures': { d: 'A quantity that strictly decreases each iteration and cannot fall forever — the loop’s own induction variable, made explicit.' },
      },
    },
  },

  // ═══ math · Applied Mathematics ════════════════════════════════════════
  'am-probability-statistics': {
    'Sample Spaces & Events': {
      d: 'All possible outcomes, and events as subsets of them — probability starts as set theory with a measure.',
      c: {
        'The Axioms': { d: 'Non-negative, sums to one, additive on disjoint events — three rules from which everything else is theorems.' },
        'Equally Likely Outcomes': { d: 'When symmetry justifies uniform weights, probability reduces to counting — combinatorics wearing a new hat.' },
      },
    },
    'Conditional Probability': {
      d: 'How evidence reshapes probability — the mechanism behind inference, filters, and a thousand paradoxes.',
      c: {
        "Bayes' Theorem": {
          d: 'Invert the conditioning: from "probability of evidence given cause" to "probability of cause given evidence".',
          c: {
            'Priors & Posteriors': { d: 'Belief before the evidence, belief after — Bayes is the exchange rate between them.' },
            'The Base-Rate Fallacy': { d: 'A 99%-accurate test for a rare disease is usually wrong when positive — the error of ignoring the prior.' },
          },
        },
        Independence: { d: 'When knowing one event tells you nothing about another — the assumption most analyses quietly stand on.' },
      },
    },
    'Random Variables': {
      d: 'Outcomes turned into numbers, so distributions can be summarized, compared, and computed with.',
      c: {
        'Expectation & Variance': { d: 'The long-run average and the spread around it — the two numbers that summarize a distribution first.' },
        'Common Distributions': { d: 'Uniform, binomial, geometric, normal — the recurring shapes randomness takes in practice.' },
      },
    },
    'Sampling & Estimation': {
      d: 'Judging a population from a sample, with honest error bars — where statistics earns its keep.',
      c: {
        'The Law of Large Numbers': { d: 'Sample means converge on true means — the theorem that makes measurement, simulation, and casinos work.' },
        'Confidence Intervals': { d: 'An interval built so the method traps the truth 95% of the time — a guarantee about the procedure, not the single answer.' },
      },
    },
  },
  'am-linear-algebra': {
    'Vectors & Vector Spaces': {
      d: 'Things you can add and scale — and the axioms that make "space" precise enough to compute in.',
      c: {
        'Linear Independence': { d: 'No vector expressible from the others — the precise sense in which dimensions are genuinely different directions.' },
        'Basis & Dimension': { d: 'A minimal spanning set, and the theorem that all of them share one size — the space’s true coordinate count.' },
      },
    },
    'Matrices as Transformations': {
      d: 'A matrix is a linear map written down: rotation, projection, scaling — composition is multiplication.',
      c: {
        'Matrix Multiplication': {
          d: 'Rows meet columns: composing transformations, with the non-commutativity that surprises everyone once.',
          c: {
            'The Cost of Multiplying': { d: 'Naively n³ operations; Strassen and successors chip the exponent below 2.4 — while cache-blocked layouts win in practice.' },
          },
        },
        'Identity & Inverses': { d: 'The do-nothing map and the exact undo — existing precisely when the transformation loses no information.' },
      },
    },
    'Eigenvalues & Eigenvectors': {
      d: 'The directions a transformation merely stretches — the axes along which complex behavior becomes simple.',
      c: {
        'The Characteristic Equation': { d: 'det(A − λI) = 0 — eigenvalues as polynomial roots, tying matrices to algebra’s oldest problem.' },
        'Power Iteration & PageRank': { d: 'Multiply a vector repeatedly and it aligns with the dominant eigenvector — the whole early web ranked by this one loop.' },
      },
    },
    'Decompositions & Rank': {
      d: 'Factor a matrix into simpler pieces — how systems get solved and data gets compressed.',
      c: {
        'Gaussian Elimination': { d: 'Row-reduce to triangular and back-substitute — the algorithm behind every "solve", hiding an LU factorization inside.' },
        'SVD & Low-Rank Approximation': { d: 'Every matrix is rotate–stretch–rotate; keep the biggest stretches and you have compression, denoising, and embeddings.' },
      },
    },
  },
  'am-modular-arithmetic': {
    'Congruences & Residues': {
      d: 'Arithmetic where numbers wrap at n — equality becomes "same remainder", and clocks become algebra.',
      c: {
        'Residue Classes': { d: 'All integers sharing one remainder, treated as a single object — ℤ/nℤ, arithmetic on the classes themselves.' },
        'Modular Exponentiation': {
          d: 'Huge powers mod n computed without huge numbers — the operation RSA performs on every message.',
          c: {
            'Repeated Squaring': { d: 'Square and reduce at each binary digit of the exponent — thousand-bit powers in a few thousand multiplications.' },
          },
        },
      },
    },
    'Modular Inverses': {
      d: 'Division mod n exists exactly when the divisor shares no factor with n — and there is an algorithm to find it.',
      c: {
        'The Extended Euclidean Algorithm': { d: 'The GCD computation that also emits the coefficients — which happen to be the modular inverse.' },
        'When Inverses Exist': { d: 'a has an inverse mod n exactly when gcd(a, n) = 1 — the units of the ring, counted by the totient.' },
      },
    },
    'Fermat & Euler Theorems': {
      d: 'Raise anything to the totient power and get 1 — the identity RSA is built directly on top of.',
      c: {
        "Euler's Totient Function": { d: 'How many residues are coprime to n — multiplicative, easy from the factorization, hard without it: RSA in one sentence.' },
        'Why RSA Decryption Works': { d: 'Encrypt-then-decrypt exponentiates by e·d ≡ 1 (mod φ(n)) — Euler’s theorem closes the loop and the message returns.' },
      },
    },
    'The Chinese Remainder Theorem': {
      d: 'Congruences with coprime moduli combine into one unique answer — split big arithmetic into parallel small pieces.',
      c: {
        'The Recombination Formula': { d: 'Weighted sums of the residues, one basis element per modulus — constructive, not just an existence claim.' },
        'CRT Speedups in RSA': { d: 'Decrypt separately mod p and q and recombine — four times faster, and a famous fault-attack surface when done sloppily.' },
      },
    },
  },

  // ═══ cs · Data Structures ══════════════════════════════════════════════
  'ds-arrays-lists': {
    'Static & Dynamic Arrays': {
      d: 'Contiguous memory with O(1) indexing — and the growth trick that makes "resizable" nearly free.',
      c: {
        'Amortized Growth': {
          d: 'Double on overflow and the occasional expensive copy averages out to constant time per append.',
          c: {
            'The Doubling Argument': { d: 'Each element is copied O(1) times on average because capacities form a geometric series — amortization made visible.' },
          },
        },
        'Multidimensional Layout': { d: 'Row-major or column-major — one choice of linearization, and loops that agree with it run cache-fast.' },
      },
    },
    'Linked Lists': {
      d: 'Nodes chained by pointers: O(1) splicing bought by surrendering random access.',
      c: {
        'Singly vs. Doubly Linked': { d: 'One pointer per node or two — cheaper storage versus backward walks and O(1) removal.' },
        'Sentinels & Dummy Nodes': { d: 'A permanent fake node at the boundary — edge cases dissolve because empty and non-empty lists share one shape.' },
      },
    },
    'Stacks & Queues': {
      d: 'Restrict where you may touch the sequence — LIFO and FIFO discipline as a feature, not a limitation.',
      c: {
        'Call Stacks': { d: 'The runtime’s own stack: frames pushed per call, popped per return — recursion is this structure wearing syntax.' },
        'Ring Buffers': { d: 'A fixed array with wrapping head and tail — queues without allocation, the shape of every IO buffer.' },
      },
    },
    'Memory Layout & Cache Effects': {
      d: 'Arrays stride predictably, lists chase pointers — the constant factors that asymptotics politely ignore.',
      c: {
        'Pointer Chasing': { d: 'Each node’s address is known only after the previous load — latency serialized, prefetchers defeated.' },
        'Structs of Arrays': { d: 'Array-of-structs keeps records together; struct-of-arrays keeps fields together — the layout question data-heavy code lives or dies by.' },
      },
    },
  },
  'ds-hash-tables': {
    'Hash Functions': {
      d: 'Deterministic chaos: spread keys uniformly so buckets stay short, cheaply enough to run on every operation.',
      c: {
        'Uniformity & Avalanche': { d: 'Similar keys must scatter to unrelated buckets — one flipped input bit should flip half the output.' },
        'Non-Cryptographic Hashes': { d: 'xxHash and friends: speed over adversarial resistance — the right trade until attackers choose your keys.' },
      },
    },
    'Collision Resolution': {
      d: 'Two keys, one bucket — the two families of answers to the inevitable.',
      c: {
        'Separate Chaining': { d: 'Each bucket holds a little list — degradation is graceful and deletion is easy.' },
        'Open Addressing': {
          d: 'Store everything in the array itself and probe for the next free slot.',
          c: {
            'Probe Sequences': { d: 'Linear, quadratic, double hashing — how the next slot is chosen decides how clustering hurts.' },
          },
        },
      },
    },
    'Load Factor & Resizing': {
      d: 'The fullness ratio that governs performance — cross the threshold and the table rebuilds itself bigger.',
      c: {
        'Rehashing Cost': { d: 'Resizing rehashes every key — one O(n) spike amortized across the inserts that caused it.' },
        'Incremental Resizing': { d: 'Migrate a few buckets per operation instead of all at once — smoothing the spike for latency-sensitive tables.' },
      },
    },
  },
  'ds-trees-heaps': {
    'Binary Search Trees': {
      d: 'Left smaller, right larger, recursively — ordered data with logarithmic everything, if balance holds.',
      c: {
        'Balanced Trees': {
          d: 'AVL, red-black: invariants that force the height to stay logarithmic no matter the insertion order.',
          c: {
            Rotations: { d: 'The constant-time local re-hang that restores balance without disturbing the ordering.' },
          },
        },
        'Ordered Traversal': { d: 'In-order walk emits sorted keys — and range queries fall out of the same descent that found one key.' },
      },
    },
    Heaps: {
      d: 'The weakest useful ordering: every parent beats its children, and that is enough for priority queues.',
      c: {
        'Array Encoding': { d: 'Parent at i, children at 2i+1 and 2i+2 — a complete tree stored with no pointers at all.' },
        'Sift Up & Sift Down': { d: 'Restore the heap property by bubbling the offender toward its place — O(log n) per repair.' },
      },
    },
    'B-Trees': {
      d: 'Wide, shallow, disk-friendly search trees — the reason databases and file systems rarely read more than a few blocks.',
      c: {
        'Fanout & Height': { d: 'Hundreds of keys per node means three levels cover millions — height is the number of disk reads, so width is the whole point.' },
        'B+ Trees & Range Scans': { d: 'Keys only in leaves, leaves chained left to right — point lookups descend, range queries just walk.' },
      },
    },
    Tries: {
      d: 'Store keys character by character along paths — prefix queries for free, memory as the price.',
      c: {
        'Prefix Matching': { d: 'Walk the query character by character; everything below the stopping node shares the prefix — autocomplete is a subtree.' },
        'Radix & Patricia Tries': { d: 'Collapse single-child chains into labeled edges — the memory fix that made tries practical, and IP routing tables possible.' },
      },
    },
  },
  'ds-graph-representations': {
    'Adjacency Lists': {
      d: 'Per-vertex neighbor lists — space proportional to what actually exists, the default for sparse graphs.',
      c: {
        'Space & Iteration Costs': { d: 'O(V + E) storage and neighbor loops proportional to actual degree — the economics that make sparse algorithms linear.' },
        'Adjacency Sets': { d: 'Swap each list for a hash set and edge queries drop to O(1) — constant factors rise, and iteration order is lost.' },
      },
    },
    'Adjacency Matrices': {
      d: 'One bit per possible edge: O(1) edge tests and algebraic superpowers, at quadratic space.',
      c: {
        'Matrix Powers & Path Counts': {
          d: 'The (i,j) entry of Aᵏ counts length-k walks — graph structure computed by pure algebra.',
          c: {
            'Transitive Closure': { d: 'Keep multiplying until nothing changes and reachability appears — Warshall’s algorithm is this loop done cleverly.' },
          },
        },
        'Bitset Packing': { d: 'One bit per edge, rows as machine words — dense graphs where a neighbor union is a single OR.' },
      },
    },
    'Edge Lists & CSR': {
      d: 'Flat arrays of edges, or compressed row storage — the layouts graph engines actually iterate.',
      c: {
        'Offset & Index Arrays': { d: 'All edges sorted by source in one array, plus per-vertex offsets into it — two arrays, zero pointers, maximal locality.' },
        'Immutability Trade-offs': { d: 'CSR iterates fast precisely because nothing can be inserted — mutation means rebuild, the price of the layout.' },
      },
    },
    'Weighted & Directed Variants': {
      d: 'Direction and cost annotations — small changes to the structure, large changes to which algorithms apply.',
      c: {
        'Weight Storage': { d: 'Parallel weight arrays or (neighbor, weight) pairs — where the cost function physically lives.' },
        'Reverse & Transpose Views': { d: 'Many algorithms need incoming edges — store the transpose too, or pay a rebuild to answer "who points at me".' },
      },
    },
  },

  // ═══ cs · Algorithms ═══════════════════════════════════════════════════
  'alg-complexity-big-o': {
    'Asymptotic Notation': {
      d: 'O, Ω, Θ — comparing growth rates while deliberately forgetting constants and small inputs.',
      c: {
        'Common Growth Classes': { d: 'log n, n, n log n, n², 2ⁿ — the ladder, and the vast practical gulf between each rung.' },
        'Constants & Lower-Order Terms': { d: 'Dropped by definition — which is why an O(n²) algorithm can beat an O(n log n) one below a million items.' },
      },
    },
    'Analyzing Recurrences': {
      d: 'Recursive algorithms cost what their recurrence says — solve it and the running time falls out.',
      c: {
        'The Master Theorem': {
          d: 'Pattern-match divide-and-conquer recurrences to their answers — three cases cover most of the classics.',
          c: {
            'The Three Cases': { d: 'Leaves dominate, levels tie, or the root dominates — compare n^log_b(a) against f(n) and read off the answer.' },
          },
        },
        'Recursion Trees': { d: 'Draw the calls, sum each level — the visual method that makes divide-and-conquer costs obvious before any theorem.' },
      },
    },
    'Space Complexity': {
      d: 'Memory grows too — and trading it against time is the oldest trick in the book.',
      c: {
        'Auxiliary vs. Total Space': { d: 'Count the scratch space or count the input too — and recursion depth counts either way, which surprises people.' },
        'Time–Space Trade-offs': { d: 'Precompute tables to answer faster, or recompute to store less — memoization on one side, streaming on the other.' },
      },
    },
    'Lower Bounds & Hardness': {
      d: 'Proofs that no algorithm can do better — comparison sorting needs n log n, and P vs. NP looms behind everything.',
      c: {
        'The Sorting Bound': { d: 'n! orderings need log(n!) ≈ n log n comparisons to distinguish — a decision-tree argument no clever code escapes.' },
        'NP-Completeness': { d: 'Thousands of problems inter-reducible in polynomial time, none known solvable in it — hardness as the field’s shared currency.' },
      },
    },
  },
  'alg-sorting-searching': {
    'Comparison Sorts': {
      d: 'Sorting by asking "which is bigger" — a family with a proven n log n floor and very different personalities.',
      c: {
        Quicksort: {
          d: 'Partition around a pivot, recurse on both sides — the fastest comparison sort in practice, with a worst case it gambles against.',
          c: {
            'Partitioning Schemes': {
              d: 'The in-place shuffle that splits the array around the pivot — where quicksort implementations actually differ.',
              c: {
                'Lomuto vs. Hoare': { d: 'One pointer sweeping versus two converging: Lomuto is teachable, Hoare does fewer swaps — both are subtly easy to get wrong.' },
              },
            },
            'Pivot Selection': { d: 'First element, median-of-three, random — the choice that decides whether sorted input is a best case or a disaster.' },
          },
        },
        Mergesort: { d: 'Split, sort halves, merge: guaranteed n log n and stable, paying with a second array.' },
        Heapsort: { d: 'Build a heap, extract the max repeatedly — n log n in place, beloved by theorists, betrayed by caches.' },
      },
    },
    'Linear-Time Sorts': {
      d: 'Skip comparisons entirely when keys have structure — counting and bucketing beat the n log n bound legally.',
      c: {
        'Counting & Radix Sort': { d: 'Tally occurrences, or sort digit by digit — linear time when the key universe cooperates.' },
        'Bucket Sort': { d: 'Scatter into ranges, sort tiny buckets, concatenate — linear on uniform data, quadratic when everything lands together.' },
      },
    },
    'Binary Search': {
      d: 'Halve the search space per question — and the classic exercise in getting boundary conditions exactly right.',
      c: {
        'Invariant Design': { d: 'Define what lo and hi promise, keep the promise every iteration — the cure for off-by-one guessing.' },
        'Search on Answers': { d: 'Binary-search the answer space itself — "can we do it with k?" is monotone, so the smallest yes is findable in log tries.' },
      },
    },
  },
  'alg-graph-traversal': {
    'Breadth-First Search': {
      d: 'Explore in rings with a queue — shortest paths in unweighted graphs fall out for free.',
      c: {
        'Distance Layers': { d: 'The queue processes vertices in rings of equal distance — BFS order IS the shortest-path proof.' },
        'Bipartiteness Testing': { d: 'Two-color as you go; an edge inside a layer betrays an odd cycle — structure detected by traversal alone.' },
      },
    },
    'Depth-First Search': {
      d: 'Follow edges as deep as they go, backtrack, repeat — the traversal whose bookkeeping reveals graph structure.',
      c: {
        'Edge Classification': { d: 'Tree, back, forward, cross — what DFS timestamps say about every edge, and how back edges betray cycles.' },
        'Topological Sort': {
          d: 'Order a DAG so every edge points forward — the dependency order of build systems and curricula alike.',
          c: {
            "Kahn's Algorithm": { d: 'Repeatedly remove zero-in-degree vertices — the queue-based topo sort that doubles as cycle detection when it stalls early.' },
          },
        },
      },
    },
    'Shortest Paths': {
      d: 'Cheapest routes under weights, where greedy works only if edges behave.',
      c: {
        "Dijkstra's Algorithm": { d: 'Settle the closest unsettled vertex, relax its edges, repeat — correct exactly because weights are non-negative.' },
        'Bellman–Ford': { d: 'Relax every edge V−1 times: slower, but negative weights are fine and negative cycles get detected.' },
      },
    },
    'Connectivity & Components': {
      d: 'Which vertices form islands — and strongly connected components when direction matters.',
      c: {
        'Union-Find': { d: 'Merge sets and answer "same component?" in near-constant amortized time — path compression doing almost impossible work.' },
        'Strongly Connected Components': { d: 'Mutually reachable clusters in digraphs — found in linear time by two DFS passes, condensing any digraph into a DAG.' },
      },
    },
  },
  'alg-dynamic-programming': {
    'Optimal Substructure': {
      d: 'The problem property DP requires: optimal solutions built from optimal solutions of subproblems.',
      c: {
        'Overlapping Subproblems': { d: 'The same subproblem recurs exponentially often in the naive recursion — caching pays exactly when this happens.' },
        'When Greedy Fails': { d: 'Coin systems where taking the largest coin misses the optimum — the counterexamples that justify DP’s extra bookkeeping.' },
      },
    },
    'Memoization vs. Tabulation': {
      d: 'Cache recursion top-down, or fill a table bottom-up — same subproblems, opposite directions.',
      c: {
        'Space-Optimized Rows': { d: 'When each row depends only on the last, keep two — O(n·m) tables shrink to O(m) with the answer intact.' },
        'Reconstructing Solutions': { d: 'The table stores values; recovering the choices means walking it backward — or storing parent pointers as you fill.' },
      },
    },
    'Classic Problems': {
      d: 'The canon: each one a template for a family of real problems.',
      c: {
        Knapsack: {
          d: 'Maximize value under a weight budget — the prototype of resource-constrained choice.',
          c: {
            '0/1 vs. Unbounded': { d: 'Take each item once, or as often as you like — one loop-order change in the same table, two different problems.' },
          },
        },
        'Edit Distance': { d: 'Fewest insertions, deletions, substitutions between strings — spell checkers and DNA alignment share this table.' },
      },
    },
    'State Design': {
      d: 'The real skill: choosing what a subproblem is, so the recurrence is both correct and small.',
      c: {
        'Bitmask States': { d: 'Encode a subset in an integer’s bits — exponential state spaces made addressable, TSP in O(2ⁿ·n²).' },
        'Choosing Transitions': { d: 'Define the last decision and the rest is a smaller problem — the question whose answer writes the recurrence.' },
      },
    },
  },

  // ═══ cs · Languages & Compilers ════════════════════════════════════════
  'pl-regular-expressions-automata': {
    'Regular Expressions': {
      d: 'A tiny algebra — concatenation, alternation, repetition — describing exactly the patterns finite memory can match.',
      c: {
        'The Three Operators': { d: 'Concatenation, alternation, star — everything else in regex syntax is sugar over these.' },
        'Extended Syntax vs. Theory': { d: 'Backreferences and lookarounds exceed regular languages — convenience features that cost the linear-time guarantee.' },
      },
    },
    'Finite Automata': {
      d: 'Machines with states and transitions, no memory beyond where they stand — regex made operational.',
      c: {
        'DFA vs. NFA': { d: 'One successor per input versus many — nondeterminism buys compactness, not power.' },
        'Subset Construction': {
          d: 'Simulate all NFA states at once and the sets themselves become DFA states — determinism recovered, exponentially in the worst case.',
          c: {
            'The Exponential Blowup': { d: 'n NFA states can need 2ⁿ DFA states, and some regexes force it — determinism has a worst-case price.' },
          },
        },
      },
    },
    'The Pumping Lemma': {
      d: 'Long strings in a regular language must contain a repeatable loop — the tool for proving a language is NOT regular.',
      c: {
        'The Adversary Game': { d: 'The demon picks the split, you pick the pump count — non-regularity proofs as a game you must win against every split.' },
        'Classic Non-Regular Languages': { d: 'aⁿbⁿ, palindromes, balanced parentheses — the languages that need counting, which finite states cannot do.' },
      },
    },
    'Lexical Analysis': {
      d: 'Regex put to work: chopping source text into tokens, the first phase of every compiler.',
      c: {
        'Maximal Munch': { d: 'Always take the longest match — why "intx" is one identifier, ">=" is one token, and lexers rarely backtrack.' },
        'Token Categories': { d: 'Identifiers, keywords, literals, operators — the coarse alphabet the parser actually reads.' },
      },
    },
  },
  'pl-grammars-parsing': {
    'Context-Free Grammars': {
      d: 'Rules that rewrite symbols into structure — expressive enough for nesting, tame enough to parse.',
      c: {
        Ambiguity: {
          d: 'One string, two parse trees — the grammar bug behind dangling-else and operator-precedence wars.',
          c: {
            'Precedence & Associativity': { d: 'Layer the grammar or annotate the parser — the two standard cures for expression ambiguity.' },
          },
        },
        Derivations: { d: 'Rewrite from the start symbol step by step — leftmost, rightmost, and the tree they all share.' },
      },
    },
    'Top-Down Parsing': {
      d: 'Grow the tree from the root, predicting which rule applies from the next tokens.',
      c: {
        'Recursive Descent': { d: 'One function per grammar rule — the parser you can write by hand and actually read.' },
        'FIRST & FOLLOW Sets': { d: 'Which tokens can begin a rule, which can follow one — the tables that tell a predictive parser which rule to pick.' },
      },
    },
    'Bottom-Up Parsing': {
      d: 'Recognize complete pieces and reduce upward — LR table machinery covering grammars prediction cannot.',
      c: {
        'Shift–Reduce Mechanics': { d: 'Push tokens, recognize a rule’s right side on the stack top, fold it — parsing as delayed decisions.' },
        'LR Conflicts': { d: 'Shift or reduce? Two reduces? — table cells with two answers, and the grammar surgery that resolves them.' },
      },
    },
    'Parse Trees & ASTs': {
      d: 'The concrete tree records the grammar; the abstract tree keeps only what later phases need.',
      c: {
        'Lowering & Desugaring': { d: 'for-loops become while-loops, interpolation becomes concatenation — surface convenience compiled into core forms.' },
        'Source Locations': { d: 'Every AST node remembers its file, line, and column — the thread error messages and debuggers hang from.' },
      },
    },
  },
  'pl-type-systems': {
    'Static vs. Dynamic Typing': {
      d: 'Catch type errors before running, or check as you go — a trade of guarantees against flexibility.',
      c: {
        'Soundness & Escape Hatches': { d: 'A sound checker rejects some correct programs; casts and any-types let you out — every practical system picks its leaks.' },
        'Gradual Typing': { d: 'Typed and untyped code in one program with checked borders — the migration path TypeScript and Python bet on.' },
      },
    },
    'Type Checking & Inference': {
      d: 'Verifying annotations is easy; deducing them from usage is where it gets interesting.',
      c: {
        Unification: {
          d: 'Solve type equations by making both sides identical — the engine inside Hindley–Milner inference.',
          c: {
            'The Occurs Check': { d: 'Refuse to solve T = List<T> — the one guard that keeps inference from building infinite types.' },
          },
        },
        'Local vs. Global Inference': { d: 'Infer within a function from annotated boundaries, or infer whole programs — predictable errors versus maximal omission.' },
      },
    },
    Polymorphism: {
      d: 'One piece of code, many types — the mechanisms that make abstraction type-safe.',
      c: {
        'Generics & Parametricity': { d: 'Type parameters constrain what code CAN do — a generic function is honest because it cannot inspect its T.' },
        'Subtyping & Variance': { d: 'When is List<Cat> a List<Animal>? Only for reading — variance rules encode which substitutions stay safe.' },
      },
    },
    'Types as Propositions': {
      d: 'Curry–Howard: a type is a claim and a program is its proof — the bridge between logic and code.',
      c: {
        'Proofs as Programs': { d: 'A function A → B is a proof that A implies B — write the program, prove the theorem, same act.' },
        'Dependent Types': { d: 'Types that mention values — a vector whose length is checked at compile time, where proving and programming fully merge.' },
      },
    },
  },
  'pl-compilers-interpreters': {
    'Compilation Pipeline': {
      d: 'Lex, parse, check, optimize, emit — a factory line where each phase consumes the previous one’s structure.',
      c: {
        'Intermediate Representations': {
          d: 'A neutral form between source and machine — SSA and friends, where optimizations actually operate.',
          c: {
            'SSA Form': { d: 'Every variable assigned exactly once, merges made explicit — the representation that turns data-flow questions into graph reachability.' },
          },
        },
        'Optimization Passes': { d: 'Constant folding, inlining, dead-code elimination — semantics-preserving rewrites that pay for the whole pipeline.' },
      },
    },
    'Code Generation': {
      d: 'From IR to real instructions: choose them, order them, and fight over registers.',
      c: {
        'Register Allocation': { d: 'Infinite virtual registers onto a dozen physical ones — graph coloring with spill code as the penalty.' },
        'Instruction Selection': { d: 'Tile the IR tree with real instructions — pattern matching where one node may cost one instruction or three.' },
      },
    },
    'Interpreters & VMs': {
      d: 'Execute the structure directly instead of translating ahead — slower per instruction, instant to start.',
      c: {
        'Bytecode & Dispatch': { d: 'Compile to a compact instruction set for a software CPU — the middle ground most dynamic languages live on.' },
        'JIT Compilation': { d: 'Interpret first, watch what gets hot, compile exactly that — paying compilation cost only where it earns.' },
      },
    },
    'Linkers & Loaders': {
      d: 'Separate compilation’s bill comes due: resolve symbols across files and place code into a runnable image.',
      c: {
        'Symbol Resolution': { d: 'Every undefined name must find exactly one definition across all object files — duplicate and missing symbols are the linker’s two famous errors.' },
        'Static vs. Dynamic Linking': { d: 'Copy libraries into the binary, or resolve them at load time — size and isolation versus sharing and updatability.' },
      },
    },
  },

  // ═══ net · Protocol Stack ══════════════════════════════════════════════
  'stk-link-layer-ethernet': {
    'Frames & MAC Addresses': {
      d: 'The link layer’s envelope: hardware addresses, a type field, a payload, and a checksum at the end.',
      c: {
        'Frame Layout': { d: 'Destination, source, type, payload, checksum — fixed offsets a NIC parses in hardware at line rate.' },
        'Broadcast & Multicast': { d: 'One address meaning everyone, and reserved ranges meaning subscribers — delivery patterns below IP’s awareness.' },
      },
    },
    'Switching & VLANs': {
      d: 'Learn which port owns which address and forward only there — plus virtual LANs slicing one switch into many.',
      c: {
        'MAC Learning': { d: 'Note the source port of every arriving frame — the switch builds its own map and floods only when ignorant.' },
        'Spanning Tree Protocol': { d: 'Redundant links form loops and loops melt networks — switches elect a root and prune to a tree, MSTs keeping LANs alive.' },
      },
    },
    ARP: {
      d: 'The question "who has this IP?" broadcast to the local network — the glue between addressing worlds.',
      c: {
        'Request & Reply': { d: 'Broadcast the question, unicast the answer, cache the result — four steps between knowing an IP and reaching a machine.' },
        'ARP Spoofing': { d: 'Answer someone else’s question first and traffic flows through you — the layer’s total lack of authentication, weaponized.' },
      },
    },
    'Error Detection': {
      d: 'Wires corrupt bits; the link layer notices before anyone acts on garbage.',
      c: {
        CRC: {
          d: 'Polynomial division in hardware: a 32-bit remainder that catches burst errors with near-certainty.',
          c: {
            'Polynomial Division': { d: 'Treat the frame as a polynomial over GF(2), divide by a generator, keep the remainder — XOR and shifts, no carries anywhere.' },
          },
        },
        'Checksums vs. CRCs': { d: 'Ones-complement sums catch single flips cheaply; CRCs catch bursts — strength matched to each layer’s failure modes.' },
      },
    },
  },
  'stk-ip-routing': {
    'IP Addressing': {
      d: 'Hierarchical addresses where the prefix encodes place — the property routing depends on.',
      c: {
        'CIDR & Subnetting': {
          d: 'Slice address space at any bit boundary — /24, /19, whatever the topology needs.',
          c: {
            'Prefix Aggregation': { d: 'Adjacent prefixes merge into one shorter announcement — the compression that keeps global routing tables merely huge.' },
          },
        },
        'IPv4 vs. IPv6': { d: 'Four billion addresses exhausted versus 2¹²⁸ — plus the header simplifications twenty years of hindsight bought.' },
      },
    },
    'Routing Tables': {
      d: 'Per-router maps from destination prefix to next hop — consulted independently for every packet.',
      c: {
        'Longest-Prefix Match': { d: 'The most specific route wins — the one rule that lets general defaults and precise exceptions coexist.' },
        'Default Routes': { d: 'The /0 prefix matching everything — "send it upstream", the modest rule most machines route by entirely.' },
      },
    },
    'Routing Protocols': {
      d: 'How routers learn the map: link-state flooding inside a network, path-vector diplomacy between networks.',
      c: {
        OSPF: { d: 'Every router floods its local view, all compute shortest paths on the shared map — Dijkstra in production.' },
        BGP: { d: 'Routing between organizations, where policy and money outrank path length — the protocol that holds the internet together, loosely.' },
      },
    },
    'NAT & Middleboxes': {
      d: 'Rewriting addresses in flight stretched IPv4 for decades — and quietly broke the end-to-end model.',
      c: {
        'Port Mapping': { d: 'Many private addresses share one public one, told apart by port — a translation table impersonating a network.' },
        'Breaking End-to-End': { d: 'Behind NAT, nobody can call you first — hole punching, relays, and STUN exist because the address lie must be maintained.' },
      },
    },
  },
  'stk-tcp-udp': {
    'UDP Datagrams': {
      d: 'Ports and a checksum, nothing more — the thinnest possible wrapper when you bring your own reliability.',
      c: {
        'Datagram Semantics': { d: 'Messages, not streams: each send is one receive, boundaries kept, order and delivery not promised.' },
        'UDP as Foundation': { d: 'DNS, QUIC, games, VoIP — protocols that need speed or custom reliability build directly on the thin layer.' },
      },
    },
    'TCP Connections': {
      d: 'A reliable ordered byte stream conjured from unreliable packets — state machines at both ends doing the pretending.',
      c: {
        'Three-Way Handshake': { d: 'SYN, SYN-ACK, ACK: both sides prove they can hear each other and agree on sequence numbers.' },
        'Sliding Windows': { d: 'Keep many packets in flight, acknowledge cumulatively — throughput without waiting one round trip per packet.' },
        'Retransmission & Timeouts': { d: 'Lost packets are inferred, never announced — timers and duplicate ACKs decide when to resend.' },
      },
    },
    'Congestion Control': {
      d: 'The network never says "slow down" — TCP infers it from loss and delay, and the internet survives because everyone backs off.',
      c: {
        'Loss-Based Algorithms': {
          d: 'Treat packet loss as the congestion signal: grow until it hurts, cut, grow again.',
          c: {
            CUBIC: {
              d: 'The Linux default: window growth as a cubic curve around the last loss point — fast recovery, gentle probing near the ceiling.',
              c: {
                'Window Growth Function': { d: 'W(t) = C(t−K)³ + W_max — plateau near the old maximum, then accelerate: the curve IS the algorithm.' },
              },
            },
          },
        },
        'Delay-Based & Hybrid': { d: 'Watch RTT rise instead of waiting for loss — BBR models the pipe and fills exactly that.' },
      },
    },
  },
  'stk-dns-naming': {
    'Name Hierarchy & Zones': {
      d: 'Dot-separated labels, authority delegated at every boundary — a distributed database disguised as names.',
      c: {
        'Root & TLD Servers': { d: 'Thirteen named roots, heavily anycast, answering one question: who owns the next label down.' },
        'Delegation & Glue': { d: 'NS records hand authority downward — with glue addresses breaking the chicken-and-egg of nameservers named inside their own zones.' },
      },
    },
    'Resolution Process': {
      d: 'From typed name to IP address: a chain of servers, each knowing one level more.',
      c: {
        'Recursive vs. Iterative': {
          d: 'Your resolver does the walking (recursive) or you follow referrals yourself (iterative) — same tree, different legwork.',
          c: {
            'Referral Chains': { d: 'Each iterative answer points one zone deeper — root to TLD to authoritative, three referrals for a cold name.' },
          },
        },
        'Stub & Recursive Resolvers': { d: 'Your machine asks one full-service resolver, which does the world-walking — caching concentrated where queries converge.' },
      },
    },
    'Record Types': {
      d: 'A, AAAA, CNAME, MX, TXT — the name maps to more than addresses.',
      c: {
        'CNAME Chains': { d: 'A name aliasing another name — resolution restarts at the target, and chains that loop or stack too deep get cut off.' },
        'TXT & Verification': { d: 'Free-form strings pressed into duty: ownership proofs, SPF policies, ACME challenges — DNS as a public bulletin board.' },
      },
    },
    'Caching & TTLs': {
      d: 'Every answer carries an expiry; caching makes DNS fast, TTLs decide how stale the world may be.',
      c: {
        'TTL Trade-offs': { d: 'Long TTLs absorb load and outages; short ones enable failover — every record picks its staleness budget.' },
        'Cache Poisoning': { d: 'Forge a response before the real one arrives and the lie is cached — the attack that motivated source-port randomization and DNSSEC.' },
      },
    },
  },

  // ═══ net · Web & Services ══════════════════════════════════════════════
  'web-http-rest': {
    'Request & Response Anatomy': {
      d: 'Method, path, headers, body — a text protocol simple enough to speak by hand through a socket.',
      c: {
        'Headers That Matter': { d: 'Host, Content-Type, Authorization, Cookie — the dozen fields carrying most of the web’s semantics.' },
        'Content Negotiation': { d: 'Accept and Content-Type haggling over format and language — one URL, many representations.' },
      },
    },
    'Methods & Status Codes': {
      d: 'The verb grammar (GET, POST, PUT, DELETE) and the three-digit reply taxonomy.',
      c: {
        'Idempotence & Safety': {
          d: 'Which requests may be retried blindly and which may not — the property proxies and clients rely on.',
          c: {
            'Retries & At-Least-Once': { d: 'Networks fail after the server acted — safe retry needs idempotence, or idempotency keys faking it for POST.' },
          },
        },
        'The Status Taxonomy': { d: '2xx success, 3xx redirection, 4xx your fault, 5xx our fault — the first digit is the contract.' },
      },
    },
    'REST Resource Design': {
      d: 'Model the domain as addressable resources and let the uniform verbs do the work — architecture, not framework.',
      c: {
        'Resource Naming': { d: 'Nouns in paths, verbs in methods — /orders/17, not /getOrder?id=17: the discipline that keeps APIs guessable.' },
        'HATEOAS & Reality': { d: 'Responses carrying the links that drive the next step — REST’s most cited constraint and its least implemented.' },
      },
    },
    'Caching & Conditional Requests': {
      d: 'ETags, max-age, if-modified-since: the machinery that lets the web serve most requests without serving them.',
      c: {
        'ETags & Validators': { d: 'A version fingerprint per representation — "give me this unless it changed" costs one header, not one body.' },
        'Cache-Control Directives': { d: 'max-age, no-store, private, immutable — the vocabulary that programs every cache between server and screen.' },
      },
    },
    'HTTP/2 & HTTP/3': {
      d: 'Multiplexed streams over one connection, then over QUIC — attacking head-of-line blocking layer by layer.',
      c: {
        'Stream Multiplexing': { d: 'Many requests interleaved on one connection, none blocking the others at the HTTP layer — the head-of-line fix, half done.' },
        "QUIC's Transport Moves": { d: 'Encryption mandatory, streams independent at the transport, connections surviving IP changes — TCP’s lessons reimplemented over UDP.' },
      },
    },
  },
  'web-sockets-apis': {
    'Socket Lifecycle': {
      d: 'Bind, listen, accept, read, write, close — the OS-level API every network abstraction bottoms out in.',
      c: {
        'The Accept Loop': { d: 'One listening socket spawning one connected socket per client — the server pattern under every framework.' },
        'Connection Teardown': { d: 'FIN handshakes, TIME_WAIT, half-closed states — ending politely is the subtle part.' },
      },
    },
    'Blocking vs. Non-Blocking IO': {
      d: 'Wait per call, or be notified when data is ready — the fork in the road for server architecture.',
      c: {
        'Event Loops': {
          d: 'One thread multiplexing thousands of connections via readiness notifications — the shape of nginx and Node alike.',
          c: {
            'epoll & Friends': { d: 'Register interest once, harvest ready sockets per tick — O(active) instead of O(watched), the syscall that scaled the web.' },
          },
        },
        'Readiness vs. Completion': { d: 'Be told a socket is readable, or be handed finished data — epoll versus io_uring and IOCP, two async philosophies.' },
      },
    },
    'WebSockets & Streaming': {
      d: 'Upgrade a request into a persistent two-way channel — the escape hatch from request/response.',
      c: {
        'The Upgrade Handshake': { d: 'An HTTP request that negotiates itself into a different protocol — port 443 reused, middleboxes appeased.' },
        'Server-Sent Events': { d: 'One long response streaming events — the simpler one-way cousin riding plain HTTP.' },
      },
    },
    'Serialization Formats': {
      d: 'JSON, protobuf, and friends — how structured data survives the trip through a byte pipe.',
      c: {
        'Text vs. Binary': { d: 'JSON’s debuggability against protobuf’s compactness and schemas — the eternal trade, decided per boundary.' },
        'Schema Evolution': { d: 'Old readers meeting new data and surviving — field numbering, optionality, and the discipline of never renaming.' },
      },
    },
  },

  // ═══ sec · Cryptography ════════════════════════════════════════════════
  'cry-symmetric-encryption': {
    'Block Ciphers': {
      d: 'Encrypt fixed-size blocks under one shared key — AES being the block cipher of record.',
      c: {
        'AES Rounds': { d: 'Substitute, shift, mix, add key — repeated ten-plus times until every output bit depends on every input bit.' },
        'Modes of Operation': {
          d: 'A block cipher alone encrypts sixteen bytes; modes extend it to messages — and choosing badly leaks patterns.',
          c: {
            'GCM & Authenticated Encryption': { d: 'Encrypt and authenticate in one pass — ciphertext that proves it has not been tampered with.' },
          },
        },
      },
    },
    'Stream Ciphers': {
      d: 'A keyed pseudorandom stream XORed over the message — fast, simple, and fatal if a keystream is ever reused.',
      c: {
        'Keystream Generation': { d: 'A key and nonce seed a generator whose output looks random — encryption is XOR, security is entirely the generator’s.' },
        'Nonce Reuse Disasters': { d: 'Two messages under one keystream XOR to their plaintext difference — the failure that broke WEP and countless homebrews.' },
      },
    },
    'Key Derivation': {
      d: 'From passwords or shared secrets to uniform keys — stretching, salting, and splitting one secret into many.',
      c: {
        'PBKDF & Argon Families': { d: 'Deliberately slow, memory-hungry functions between password and key — cost tuned upward as attackers’ hardware improves.' },
        'One Secret, Many Keys': { d: 'HKDF-style expansion labels each derived key by purpose — encryption and MAC keys never shared, rotation without re-agreement.' },
      },
    },
  },
  'cry-public-key-cryptography': {
    RSA: {
      d: 'Encrypt with a public modulus, decrypt with its secret factorization — security resting on multiplication being easy and factoring hard.',
      c: {
        'Key Generation': {
          d: 'Two large primes and some modular arithmetic — the private key’s safety is decided entirely here.',
          c: {
            'Prime Selection': {
              d: 'Finding random primes of hundreds of digits, quickly and with near-certain confidence.',
              c: {
                'Miller–Rabin Test': { d: 'A probabilistic witness test: each random round that fails to expose compositeness quarters the doubt — run forty and move on.' },
              },
            },
          },
        },
        'Padding Schemes': { d: 'Raw RSA is deterministic and malleable — OAEP-style padding is what makes it an actual encryption scheme.' },
      },
    },
    'Diffie–Hellman': {
      d: 'Two parties mix public values with private exponents and arrive at the same secret — agreement without ever sending it.',
      c: {
        'Elliptic-Curve Variants': { d: 'Same trick over curve points instead of integers — equal security from far smaller keys.' },
        'The Discrete-Log Problem': { d: 'g^x mod p is easy forward, believed hard backward — the one-way street the whole agreement drives on.' },
      },
    },
    'Digital Signatures': {
      d: 'Sign with the private key, verify with the public one — authenticity and non-repudiation from the same keypair.',
      c: {
        'Hash-then-Sign': { d: 'Sign the digest, not the message — speed, and immunity to algebraic forgeries on structured plaintexts.' },
        'What Verification Proves': { d: 'Anyone with the public key checks the math; whether the key belongs to whom you think is the part math cannot do.' },
      },
    },
  },
  'cry-cryptographic-hashing': {
    'Hash Properties': {
      d: 'Preimage, second-preimage, and collision resistance — three distinct promises, broken in that order historically.',
      c: {
        'Collision Resistance': { d: 'No feasible pair with one digest — the strongest of the three properties and always the first to fall.' },
        'The Birthday Bound': { d: 'Collisions appear near √N tries, not N — 128-bit hashes offer 64-bit collision security, halved by arithmetic alone.' },
      },
    },
    'Merkle–Damgård & SHA': {
      d: 'Chain a compression function over blocks — the construction behind MD5, SHA-1, SHA-2, and their shared length-extension quirk.',
      c: {
        'Compression Functions': { d: 'A fixed-size mixer iterated over blocks — the whole hash’s security concentrated in one primitive.' },
        'Length-Extension Attacks': {
          d: 'Knowing H(secret‖msg) lets you append and keep hashing — the structural leak of chaining constructions.',
          c: {
            'Why HMAC Survives': { d: 'The nested keyed structure re-hashes the outer state — extension gains nothing, which is exactly why HMAC exists.' },
          },
        },
      },
    },
    'HMAC & Message Authentication': {
      d: 'A keyed hash proving both integrity and origin — the workhorse of API signing and session tokens.',
      c: {
        'The Nested Construction': { d: 'Hash the message with an inner key, hash that result with an outer key — two passes, proved secure even under weakened hashes.' },
        'Timing-Safe Comparison': { d: 'Compare MACs byte-by-byte with early exit and the reject time leaks the match length — constant-time equality is mandatory.' },
      },
    },
    'Password Hashing': {
      d: 'Storing passwords means storing something an attacker with the database still cannot use.',
      c: {
        'Salts & Work Factors': { d: 'Unique salt kills rainbow tables; a tunable cost keeps brute force expensive as hardware improves.' },
        'Cracking Economics': { d: 'Attackers buy hashes per second; work factors set the price per guess — defense measured in dollars, not bits.' },
      },
    },
  },
  'cry-tls-certificates': {
    'Handshake Protocol': {
      d: 'Negotiate versions and ciphers, authenticate the server, establish keys — all before the first byte of application data.',
      c: {
        'Key Exchange & Forward Secrecy': {
          d: 'Ephemeral Diffie–Hellman per session: steal the server key tomorrow, yesterday’s traffic stays sealed.',
          c: {
            'The TLS 1.3 Cut': { d: 'Static RSA exchange removed, one round trip, everything after the hellos encrypted — decades of options pruned to the sound core.' },
          },
        },
        'Session Resumption': { d: 'Tickets and pre-shared keys skip the full handshake on return visits — round trips traded against forward-secrecy nuance.' },
      },
    },
    'Certificate Anatomy': {
      d: 'A public key plus identity claims, signed by an authority — X.509’s baroque but load-bearing format.',
      c: {
        'Subject & SAN Fields': { d: 'The names a certificate vouches for — browsers match the URL against SANs, the Common Name long deprecated.' },
        'Validity Windows': { d: 'Not-before and not-after — lifetimes now capped near a year, forcing rotation to be routine instead of ceremonial.' },
      },
    },
    'Chains & Authorities': {
      d: 'Trust flows from root stores through intermediates to sites — a hierarchy of signatures your browser walks silently.',
      c: {
        'Root Stores': { d: 'The few hundred CAs your OS and browser were born trusting — membership policed by audits and the memory of DigiNotar.' },
        'Intermediate CAs': { d: 'Roots stay offline and sign intermediates that sign the world — compromise contained one level down from the anchors.' },
      },
    },
    'Revocation': {
      d: 'Certificates get compromised before they expire — CRLs, OCSP, and the awkward truth that revocation half-works.',
      c: {
        'CRLs & OCSP': { d: 'Download the blacklist, or ask per certificate — one stale, one slow and privacy-leaking: pick your failure.' },
        'OCSP Stapling': { d: 'The server fetches its own freshness proof and staples it to the handshake — the checker no longer phones home.' },
      },
    },
  },

  // ═══ sec · Applied Security ════════════════════════════════════════════
  'app-authentication-authorization': {
    'Passwords & Beyond': {
      d: 'Something you know, have, or are — and why the first alone stopped being enough.',
      c: {
        'Credential Stuffing': { d: 'Billions of leaked pairs replayed everywhere — reuse, not cracking, is how most accounts actually fall.' },
        'Passkeys & WebAuthn': { d: 'Per-site keypairs with the private half in hardware — nothing shared to steal, nothing reusable to phish.' },
      },
    },
    'Sessions & Tokens': {
      d: 'HTTP forgets you between requests; sessions and tokens are how systems remember who is asking.',
      c: {
        JWTs: {
          d: 'Signed claims the server can verify without a lookup — stateless authentication, with revocation as the catch.',
          c: {
            'The Revocation Problem': { d: 'A signed token is valid until expiry no matter what — logout becomes short lifetimes, refresh tokens, and denylists.' },
          },
        },
        'Cookie Sessions': { d: 'A random ID in a cookie, state on the server — revocable instantly, scaled with sticky sessions or shared stores.' },
      },
    },
    'Multi-Factor Authentication': {
      d: 'Combine independent factors so one stolen credential is not enough — phishing resistance varies wildly by method.',
      c: {
        'TOTP Codes': { d: 'A shared secret hashed with the clock — six digits proving possession, phishable in real time.' },
        'Hardware Keys': { d: 'The authenticator signs the site’s actual origin — the phishing-resistant factor, because users cannot approve what the key refuses.' },
      },
    },
    'Access Control Models': {
      d: 'Authenticated is not authorized: the frameworks deciding who may do what.',
      c: {
        'RBAC & Least Privilege': { d: 'Permissions attach to roles, people get roles, and nobody holds more power than their job needs.' },
        'Capabilities & ACLs': { d: 'Rights attached to the holder versus lists attached to the object — two dual bookkeepings of the same permissions.' },
      },
    },
  },
  'app-common-vulnerabilities': {
    'Injection Attacks': {
      d: 'Data crossing into code: the oldest and still most common way in.',
      c: {
        'SQL Injection': {
          d: 'User input concatenated into queries — solved decades ago by parameterization, exploited daily anyway.',
          c: {
            'Parameterized Queries': { d: 'Code and data travel separately to the database — the complete fix, three decades old, still not universal.' },
          },
        },
        'Cross-Site Scripting': { d: 'Attacker JavaScript running in the victim’s page — every unescaped output is a potential stage.' },
      },
    },
    'Memory Safety Bugs': {
      d: 'The C-family failure class: writes that land outside their welcome.',
      c: {
        'Buffer Overflows': { d: 'Write past the end of a buffer onto return addresses — the classic path from bug to code execution.' },
        'Use-After-Free': { d: 'A dangling pointer into reallocated memory — the modern exploit substrate now that overflows are guarded.' },
      },
    },
    'CSRF & Session Attacks': {
      d: 'The browser helpfully attaches your cookies to forged requests — riding a session without ever stealing it.',
      c: {
        'Anti-Forgery Tokens': { d: 'A per-session secret the attacker’s page cannot read — proof the request came from your form, not just your browser.' },
        'SameSite Cookies': { d: 'Cookies withheld on cross-site requests by default — the browser-level fix that demoted CSRF from epidemic to legacy.' },
      },
    },
    'Supply-Chain Risks': {
      d: 'Your code is fine; a dependency of a dependency is not — trust extended transitively to strangers.',
      c: {
        'Dependency Confusion': { d: 'Publish a public package with an internal name and a higher version — resolvers helpfully install the attacker’s copy.' },
        'Lockfiles & Pinning': { d: 'Exact versions and hashes recorded and verified — builds that refuse to drift, the baseline defense.' },
      },
    },
  },

  // ═══ se · Practices ════════════════════════════════════════════════════
  'prc-version-control': {
    'Commits & History': {
      d: 'Immutable snapshots with parent links — the project’s history as a graph you can query and travel.',
      c: {
        'Commit Anatomy': { d: 'A tree hash, parent hashes, author, message — sign it and the whole history below is tamper-evident.' },
        'History Rewriting': { d: 'Amend, rebase, filter — rewriting makes new commits and abandons old ones, safe until someone else built on them.' },
      },
    },
    'Branching & Merging': {
      d: 'Cheap parallel lines of development — and the reconciliation when they meet again.',
      c: {
        'Merge Conflicts': { d: 'Two edits to the same lines: the tool stops and a human decides — conflict is a feature, not a failure.' },
        'Rebase vs. Merge': { d: 'Replay commits onto a new base for linear history, or merge and keep the true shape — teams pick a religion.' },
      },
    },
    'Git Internals': {
      d: 'Under the porcelain, a content-addressed object database — understanding it turns git from incantations into a system.',
      c: {
        'The Object Model': {
          d: 'Blobs, trees, commits, tags — four object types, each named by the hash of its content.',
          c: {
            Packfiles: {
              d: 'Loose objects compacted into indexed archives — how a decade of history fits in megabytes.',
              c: {
                'Delta Compression': { d: 'Store one version whole and the rest as diffs against it — chosen pairwise by similarity, not by history.' },
              },
            },
          },
        },
        'Refs & The Index': { d: 'Branches are just files containing a hash; the index is the staging photograph the next commit will be.' },
      },
    },
    'Collaboration Workflows': {
      d: 'Fork-and-PR, trunk-based, gitflow — social contracts layered on the same primitive operations.',
      c: {
        'Trunk-Based Development': { d: 'Everyone integrates to main daily behind feature flags — merge pain amortized into invisibility.' },
        'Fork & Pull Request': { d: 'Contributors work in their own copies and propose; maintainers review and merge — open source’s permission model.' },
      },
    },
  },
  'prc-code-review': {
    'What Reviews Catch': {
      d: 'Less "bugs" than design drift, missing tests, and unshared context — the empirical case is about knowledge, not defects.',
      c: {
        'Knowledge Sharing': { d: 'After the review, two people understand the change — the bus-factor dividend that outlasts any defect found.' },
        'What Reviews Miss': { d: 'Subtle logic and cross-file interactions slip through — reviews complement tests precisely because they fail differently.' },
      },
    },
    'Pull Request Workflow': {
      d: 'Propose, discuss, revise, approve, merge — asynchronous review as the unit of team change.',
      c: {
        'Diff Size & Effectiveness': {
          d: 'Defect-finding falls off a cliff as diffs grow — reviewers approve what they cannot absorb.',
          c: {
            'The 400-Line Ceiling': { d: 'Industry studies converge on a few hundred lines per session — past it, "looks good to me" measures fatigue, not quality.' },
          },
        },
        'Stacked Changes': { d: 'A big feature as a chain of small dependent PRs — each reviewable alone, landed in order.' },
      },
    },
    'Giving & Receiving Feedback': {
      d: 'Comment on the code, not the coder; distinguish blocking from preference — craft that keeps reviews useful and teams intact.',
      c: {
        'Blocking vs. Nit': { d: 'Marking comments blocking, suggestion, or nit — the difference between a gate and a conversation.' },
        'Questions over Commands': { d: '"What happens if x is null?" teaches; "change this" merely complies — the phrasing that keeps reviews collegial.' },
      },
    },
  },
  'prc-design-patterns': {
    'Creational Patterns': {
      d: 'Decoupling what gets made from where it is made.',
      c: {
        'Factory & Builder': { d: 'Hide the constructor behind intent: families of related objects, or complex assembly step by step.' },
        'Singleton & Its Critics': { d: 'One instance, globally reachable — beloved by frameworks, resented by tests, and mostly replaced by injection.' },
      },
    },
    'Structural Patterns': {
      d: 'Composing objects into larger shapes without welding them together.',
      c: {
        'Adapter & Facade': { d: 'Wrap an awkward interface to fit, or put one simple face on a complicated subsystem.' },
        'Decorator & Composite': { d: 'Wrap to add behavior, nest to treat groups as one — the two patterns that make recursive structures uniform.' },
      },
    },
    'Behavioral Patterns': {
      d: 'Distributing responsibility: who calls whom, who knows what.',
      c: {
        'Observer & Strategy': { d: 'Notify subscribers of changes; swap algorithms behind one interface — the two patterns hiding in every framework.' },
        Visitor: {
          d: 'Add operations to a stable object structure without touching it — double dispatch doing the walking.',
          c: {
            'Double Dispatch': { d: 'The operation chosen by two runtime types at once — accept() plus visit() simulating what single-dispatch languages lack.' },
          },
        },
      },
    },
    'Patterns as Vocabulary': {
      d: 'The lasting value is the shared names — "that is an adapter" transmits a design in three words. Overuse is its own anti-pattern.',
      c: {
        'Patterns Absorbed by Languages': { d: 'Iterators became for-loops, strategies became lambdas — a pattern is often a missing feature with a name.' },
        'Anti-Patterns': { d: 'God objects, golden hammers, cargo-cult ceremony — the shared names for what to stop doing.' },
      },
    },
  },

  // ═══ se · Testing ══════════════════════════════════════════════════════
  'tst-unit-testing': {
    'Test Anatomy': {
      d: 'Arrange, act, assert — one behavior per test, named so the failure message is the diagnosis.',
      c: {
        'Naming for Diagnosis': { d: 'The test name states behavior and condition — a failing list should read as a bug report.' },
        'Fixtures & Setup': { d: 'Shared arrangement extracted per suite — DRY tests against readable ones, the eternal small war.' },
      },
    },
    'Test Doubles': {
      d: 'Stand-ins for real collaborators, so a unit can be tested alone.',
      c: {
        'Mocks vs. Stubs': {
          d: 'Stubs feed canned answers; mocks verify interactions happened — confusing them couples tests to implementation.',
          c: {
            'Over-Mocking': { d: 'Mock every collaborator and the test restates the implementation — red on harmless changes, green on real bugs.' },
          },
        },
        'Fakes & In-Memory Implementations': { d: 'A working substitute — an in-memory repository beats a mock when behavior, not interaction, is the point.' },
      },
    },
    'Coverage & Its Limits': {
      d: 'Executed lines are not verified behavior — coverage finds untested code, never untested cases.',
      c: {
        'Line vs. Branch Coverage': { d: 'Executing a line is not exercising both sides of its if — branch coverage is the honest minimum.' },
        'Mutation Testing': { d: 'Seed artificial bugs and check the suite notices — coverage of assertions, not just execution.' },
      },
    },
    'Test-Driven Development': {
      d: 'Red, green, refactor: write the failing test first and let it pull the design out of you.',
      c: {
        'Red–Green–Refactor': { d: 'Fail first proves the test can fail; pass minimally; clean up under protection — the loop, three breaths long.' },
        'When TDD Fits': { d: 'Crisp specifiable units, yes; exploratory UI and glue, less so — a practice, not a religion.' },
      },
    },
  },
  'tst-integration-testing': {
    'Test Environments': {
      d: 'Real database, real queue, containerized per run — realism traded against speed and flakiness.',
      c: {
        'Containerized Dependencies': { d: 'Real Postgres in a throwaway container per run — realism without shared-environment rot.' },
        'Environment Parity': { d: 'The bug that only happens in prod is a parity failure — versions, config, and data shape all drift.' },
      },
    },
    'Contract Tests': {
      d: 'Provider and consumer each verify the shared interface — integration confidence without integrated test runs.',
      c: {
        'Consumer-Driven Contracts': { d: 'Consumers publish what they rely on; providers verify against it — integration guaranteed without integrating.' },
        'Schema Compatibility': {
          d: 'Changes checked against the contract before deploy — additive is safe, removal and retyping break someone.',
          c: {
            'Backward & Forward Compatibility': { d: 'Old readers with new data, new readers with old — the two directions every schema change must clear.' },
          },
        },
      },
    },
    'Test Data Management': {
      d: 'Fixtures, factories, seeded snapshots — stale or entangled data is where integration suites go to rot.',
      c: {
        'Factories & Fixtures': { d: 'Build test objects programmatically with defaults, override what matters — data that documents the case it serves.' },
        'Isolation Between Tests': { d: 'Each test owns its data — transaction rollbacks or unique keys, because shared rows make suites order-dependent.' },
      },
    },
    'Fighting Flakiness': {
      d: 'Timing, ordering, shared state: a test that sometimes fails teaches the team to ignore red — fix or delete it.',
      c: {
        'Timing & Async Waits': { d: 'sleep(2) is a guess that will be wrong — poll for the condition, or inject a controllable clock.' },
        'Quarantine Policies': { d: 'Flaky tests move to a non-blocking lane with an expiry — trust in red preserved, debt made visible.' },
      },
    },
  },
  'tst-property-based-testing': {
    'Properties & Invariants': {
      d: 'Assert what must hold for ALL inputs — reversing a reversal yields the original — instead of hand-picking examples.',
      c: {
        'Round-Trip Properties': { d: 'decode(encode(x)) = x — the property serialization, parsing, and persistence all owe you.' },
        'Metamorphic Properties': { d: 'When the right answer is unknown, relate answers: sorting a shuffle equals sorting the original.' },
      },
    },
    Generators: {
      d: 'Structured random input factories — the vocabulary the framework uses to explore your input space.',
      c: {
        'Size & Distribution': { d: 'Generators grow cases from small to large and weight the interesting regions — coverage is a design act, not luck.' },
        'Composing Generators': {
          d: 'Map, filter, and bind small generators into structured ones — the combinator algebra of test input.',
          c: {
            'Recursive Generators': { d: 'Generating trees means bounding depth explicitly — unchecked recursion makes infinite or astronomically large cases.' },
          },
        },
      },
    },
    Shrinking: {
      d: 'When a random case fails, the framework minimizes it automatically — you debug the essence, not the noise.',
      c: {
        'Greedy Shrink Search': { d: 'Try smaller variants, keep any that still fail, repeat to a local minimum — automated delta debugging.' },
        'Shrinking Under Invariants': { d: 'Shrunk cases must still satisfy the generator’s constraints — integrated shrinking gets this free, manual shrinkers forget it.' },
      },
    },
    'Model-Based Testing': {
      d: 'Run random operation sequences against a simple reference model — the property is "the real thing agrees with the obvious thing".',
      c: {
        'Reference Models': { d: 'A dict standing in for the database — slow, obvious, and correct is exactly what an oracle should be.' },
        'Command Sequences': { d: 'Generate operation lists, interleave, compare states — the technique that corners stateful and concurrent bugs.' },
      },
    },
  },

  // ═══ se · Tooling ══════════════════════════════════════════════════════
  'tool-shell-scripting': {
    'Pipes & Redirection': {
      d: 'Small programs composed through text streams — the original composable architecture.',
      c: {
        'The Three Streams': { d: 'stdin, stdout, stderr — separable, redirectable, and the reason errors don’t corrupt pipelines.' },
        'Exit Codes & Pipelines': { d: 'Zero is success, anything else failure — && and || branch on it, and pipefail decides whose failure counts.' },
      },
    },
    'Text Processing Tools': {
      d: 'The classic trio for slicing streams: search, edit, report.',
      c: {
        'grep, sed & awk': {
          d: 'Filter lines by pattern, transform them in flight, compute over fields — a data pipeline in one command line.',
          c: {
            'Regex Dialects': { d: 'Basic, extended, Perl-compatible — the same pattern means three things across tools, the classic portability trap.' },
          },
        },
        'sort, uniq & cut': { d: 'Order lines, collapse duplicates, slice columns — with sort | uniq -c as the ur-histogram.' },
      },
    },
    'Scripting Constructs': {
      d: 'Variables, conditionals, loops, exit codes — enough language to automate, plus quoting rules that bite everyone.',
      c: {
        'Quoting & Word Splitting': { d: 'Unquoted variables split on whitespace and glob — the single largest source of shell bugs, fixed by reflexive double quotes.' },
        'Strict Mode': { d: 'set -euo pipefail — exit on error, on unset variables, on pipeline failure: the defaults scripts should have had.' },
      },
    },
    'Job Control': {
      d: 'Foreground, background, signals, kill — the shell as a process supervisor, not just a launcher.',
      c: {
        'Signals & Traps': { d: 'SIGINT, SIGTERM, SIGKILL and trap handlers — cleanup on interrupt is opt-in, and kill -9 skips it entirely.' },
        'Background & nohup': { d: '& detaches from your attention, nohup from your terminal — the difference discovered at logout.' },
      },
    },
  },
  'tool-debuggers-profilers': {
    'Breakpoints & Stepping': {
      d: 'Stop time at a chosen line and walk it forward — the debugger’s basic bargain.',
      c: {
        'Conditional Breakpoints': { d: 'Stop only when the predicate holds — the thousandth iteration reached without a thousand continues.' },
        Watchpoints: { d: 'Break when memory changes, whoever changes it — hardware-assisted, and the cure for "who corrupted this?"' },
      },
    },
    'State Inspection': {
      d: 'Variables, call stacks, watch expressions — reading the program’s actual state instead of guessing at it.',
      c: {
        'Stack Walks': { d: 'Frame by frame from the crash upward — the call path as evidence, locals intact at every level.' },
        'Core Dumps': { d: 'The process’s memory frozen at death — post-mortem debugging of crashes you weren’t attached to.' },
      },
    },
    'Sampling Profilers': {
      d: 'Interrupt periodically and record where the program was — a statistical picture with negligible overhead.',
      c: {
        'Flame Graphs': {
          d: 'Stack samples stacked into a skyline — width is time, and the widest plateau is your bottleneck.',
          c: {
            'Off-CPU Flame Graphs': { d: 'Sample blocked time instead of running time — where the program waits, which is usually the actual complaint.' },
          },
        },
        'Sampling Bias & Rates': { d: 'Short-lived functions hide between ticks; higher rates see more and distort more — statistics with an observer effect.' },
      },
    },
    'Instrumentation & Tracing': {
      d: 'Inject measurement into the code path — exact counts and timelines, bought with overhead sampling avoids.',
      c: {
        'Tracepoints & Probes': { d: 'Hooks compiled in or injected live — per-event records where sampling would blur.' },
        'Overhead Budgets': { d: 'Measurement changes timing — heisenbugs vanish under instrumentation, and budgets keep tracing honest.' },
      },
    },
  },

  // ═══ se · Automation ═══════════════════════════════════════════════════
  'auto-continuous-integration': {
    'Pipelines & Stages': {
      d: 'Build, test, package as declared steps — the merge gate as configuration, versioned next to the code.',
      c: {
        'Fan-Out & Fan-In': { d: 'Split into parallel test shards, join before the gate — wall-clock time bought with runners.' },
        'Required Checks': { d: 'The branch protection contract: these jobs green or no merge — CI’s opinion made enforceable.' },
      },
    },
    'Build Reproducibility': {
      d: 'Pinned dependencies, hermetic environments — the same inputs must yield the same artifact, or CI results mean nothing.',
      c: {
        'Dependency Pinning': { d: 'Exact versions, hashed artifacts — the build inputs frozen so today’s green means tomorrow’s green.' },
        'Hermetic Builds': { d: 'No network, no system state, declared inputs only — the sandbox that makes caching sound and results portable.' },
      },
    },
    'Artifacts & Caching': {
      d: 'Reuse what has not changed: cached dependencies and shared build outputs are the difference between minutes and hours.',
      c: {
        'Cache Keys & Invalidation': { d: 'Key on the lockfile hash and restore in layers — a wrong key serves stale dependencies silently.' },
        'Artifact Promotion': { d: 'Build once, deploy the same bytes everywhere — environments differ in config, never in binaries.' },
      },
    },
  },
  'auto-deployment-monitoring': {
    'Deployment Strategies': {
      d: 'Ways to replace running software without a maintenance window.',
      c: {
        'Blue-Green & Canary': { d: 'Flip traffic between two identical stacks, or leak a percentage to the new version and watch it before committing.' },
        'Rolling Updates': { d: 'Replace instances a few at a time behind the balancer — zero downtime with both versions briefly live, so compatibility is the real feature.' },
      },
    },
    'Rollbacks': {
      d: 'The deploy is not safe because it cannot fail; it is safe because undoing it is one boring, rehearsed step.',
      c: {
        'Roll Forward vs. Back': { d: 'Redeploy the old version, or hotfix ahead — pick whichever is boring; incidents are no time for interesting.' },
        'Data Migration Hazards': { d: 'Code rolls back in seconds; a dropped column does not — schema changes must outlive the deploys that ride them.' },
      },
    },
    Telemetry: {
      d: 'Production observed: the three signal families every incident is debugged from.',
      c: {
        'Metrics, Logs & Traces': { d: 'Numbers over time, events with context, request paths across services — each answers questions the others cannot.' },
        'Cardinality & Cost': { d: 'A label per user turns one metric into a million series — observability bills are cardinality bills.' },
      },
    },
    'Alerting & SLOs': {
      d: 'Define how good is good enough, page humans only when the error budget is actually burning.',
      c: {
        'Error Budgets': { d: 'The allowed unreliability, spent deliberately — when the budget burns, features yield to stability by prior agreement.' },
        'Alert Fatigue': { d: 'Pages that need no action teach on-call to ignore pages — every alert must be actionable or deleted.' },
      },
    },
  },
}
