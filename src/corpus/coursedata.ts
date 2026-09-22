// GENERATED FILE — DO NOT EDIT BY HAND.
// The course corpus: 36 courses in 7 subject areas, 33 published prerequisites.
//
// Written by `node tools/courseimport/generate.mjs` from
// `tools/courseimport/courses.json`, which is the file to change. The JSON is a
// hand-reviewed reading of Toronto Metropolitan University's published Computer
// Science course outlines; `tools/courseimport/README.md` records where every
// field came from and which judgments are the author's rather than the
// university's.

import type { CorpusSpec, DeepSpec, GNode } from './graphshape'

/** the tree: program, subject areas, required/elective modules, then the courses
 *  themselves as the edge-bearing level — a COURSE is this corpus's "topic" */
const nodes: GNode[] = [
  {
    id: "root",
    kind: "container",
    parentId: null,
    title: "Computer Science, Toronto Metropolitan University",
  },
  {
    id: "lang",
    kind: "container",
    parentId: "root",
    title: "Programming & Languages",
    hue: "rose",
  },
  {
    id: "lang-core",
    kind: "container",
    parentId: "lang",
    title: "Required",
  },
  {
    id: "cps109",
    kind: "leaf",
    parentId: "lang-core",
    title: "CPS 109 Computer Science I",
    topic: true,
  },
  {
    id: "cps209",
    kind: "leaf",
    parentId: "lang-core",
    title: "CPS 209 Computer Science II",
    topic: true,
  },
  {
    id: "cps393",
    kind: "leaf",
    parentId: "lang-core",
    title: "CPS 393 Introduction to UNIX, C and C++",
    topic: true,
  },
  {
    id: "cps506",
    kind: "leaf",
    parentId: "lang-core",
    title: "CPS 506 Comparative Programming Languages",
    topic: true,
  },
  {
    id: "lang-elective",
    kind: "container",
    parentId: "lang",
    title: "Elective",
  },
  {
    id: "cps710",
    kind: "leaf",
    parentId: "lang-elective",
    title: "CPS 710 Compilers and Interpreters",
    topic: true,
  },
  {
    id: "lang-outside",
    kind: "container",
    parentId: "lang",
    title: "Other departments",
  },
  {
    id: "cps118",
    kind: "leaf",
    parentId: "lang-outside",
    title: "CPS 118 Introduction to Computer Programming",
    topic: true,
  },
  {
    id: "cps125",
    kind: "leaf",
    parentId: "lang-outside",
    title: "CPS 125 Digital Computation and Programming",
    topic: true,
  },
  {
    id: "algo",
    kind: "container",
    parentId: "root",
    title: "Algorithms & Theory",
    hue: "fern",
  },
  {
    id: "algo-core",
    kind: "container",
    parentId: "algo",
    title: "Required",
  },
  {
    id: "cps305",
    kind: "leaf",
    parentId: "algo-core",
    title: "CPS 305 Data Structures",
    topic: true,
  },
  {
    id: "cps420",
    kind: "leaf",
    parentId: "algo-core",
    title: "CPS 420 Discrete Structures",
    topic: true,
  },
  {
    id: "algo-outside",
    kind: "container",
    parentId: "algo",
    title: "Other departments",
  },
  {
    id: "coe428",
    kind: "leaf",
    parentId: "algo-outside",
    title: "COE 428 COE 428",
    topic: true,
  },
  {
    id: "mth210",
    kind: "leaf",
    parentId: "algo-outside",
    title: "MTH 210 MTH 210",
    topic: true,
  },
  {
    id: "mth304",
    kind: "leaf",
    parentId: "algo-outside",
    title: "MTH 304 MTH 304",
    topic: true,
  },
  {
    id: "mth314",
    kind: "leaf",
    parentId: "algo-outside",
    title: "MTH 314 MTH 314",
    topic: true,
  },
  {
    id: "math",
    kind: "container",
    parentId: "root",
    title: "Mathematics & Science",
    hue: "honey",
  },
  {
    id: "math-core",
    kind: "container",
    parentId: "math",
    title: "Required",
  },
  {
    id: "mth108",
    kind: "leaf",
    parentId: "math-core",
    title: "MTH 108 Linear Algebra",
    topic: true,
  },
  {
    id: "mth207",
    kind: "leaf",
    parentId: "math-core",
    title: "MTH 207 Calculus and Computational Methods I",
    topic: true,
  },
  {
    id: "blg143",
    kind: "leaf",
    parentId: "math-core",
    title: "BLG 143 Biology I",
    topic: true,
  },
  {
    id: "sys",
    kind: "container",
    parentId: "root",
    title: "Computer Systems",
    hue: "cobalt",
  },
  {
    id: "sys-core",
    kind: "container",
    parentId: "sys",
    title: "Required",
  },
  {
    id: "cps213",
    kind: "leaf",
    parentId: "sys-core",
    title: "CPS 213 Computer Organization I",
    topic: true,
  },
  {
    id: "cps310",
    kind: "leaf",
    parentId: "sys-core",
    title: "CPS 310 Computer Organization II",
    topic: true,
  },
  {
    id: "cps590",
    kind: "leaf",
    parentId: "sys-core",
    title: "CPS 590 Operating Systems I",
    topic: true,
  },
  {
    id: "sys-elective",
    kind: "container",
    parentId: "sys",
    title: "Elective",
  },
  {
    id: "cps730",
    kind: "leaf",
    parentId: "sys-elective",
    title: "CPS 730 Web Technology and Performance Measurement",
    topic: true,
  },
  {
    id: "cps801",
    kind: "leaf",
    parentId: "sys-elective",
    title: "CPS 801 Operating Systems II",
    topic: true,
  },
  {
    id: "seng",
    kind: "container",
    parentId: "root",
    title: "Software Engineering",
    hue: "clay",
  },
  {
    id: "seng-core",
    kind: "container",
    parentId: "seng",
    title: "Required",
  },
  {
    id: "cps406",
    kind: "leaf",
    parentId: "seng-core",
    title: "CPS 406 Introduction to Software Engineering",
    topic: true,
  },
  {
    id: "seng-elective",
    kind: "container",
    parentId: "seng",
    title: "Elective",
  },
  {
    id: "cps707",
    kind: "leaf",
    parentId: "seng-elective",
    title: "CPS 707 Software Verification and Validation",
    topic: true,
  },
  {
    id: "cps714",
    kind: "leaf",
    parentId: "seng-elective",
    title: "CPS 714 Software Project Management",
    topic: true,
  },
  {
    id: "cps831",
    kind: "leaf",
    parentId: "seng-elective",
    title: "CPS 831 Software Engineering II",
    topic: true,
  },
  {
    id: "data",
    kind: "container",
    parentId: "root",
    title: "Data & Intelligence",
    hue: "teal",
  },
  {
    id: "data-core",
    kind: "container",
    parentId: "data",
    title: "Required",
  },
  {
    id: "cps510",
    kind: "leaf",
    parentId: "data-core",
    title: "CPS 510 Database Systems I",
    topic: true,
  },
  {
    id: "cps721",
    kind: "leaf",
    parentId: "data-core",
    title: "CPS 721 Artificial Intelligence I",
    topic: true,
  },
  {
    id: "data-elective",
    kind: "container",
    parentId: "data",
    title: "Elective",
  },
  {
    id: "cps501",
    kind: "leaf",
    parentId: "data-elective",
    title: "CPS 501 Bioinformatics",
    topic: true,
  },
  {
    id: "cps803",
    kind: "leaf",
    parentId: "data-elective",
    title: "CPS 803 Machine Learning",
    topic: true,
  },
  {
    id: "cps822",
    kind: "leaf",
    parentId: "data-elective",
    title: "CPS 822 Artificial Intelligence II",
    topic: true,
  },
  {
    id: "cps824",
    kind: "leaf",
    parentId: "data-elective",
    title: "CPS 824 Reinforcement Learning",
    topic: true,
  },
  {
    id: "cps840",
    kind: "leaf",
    parentId: "data-elective",
    title: "CPS 840 Selected Topics in Computer Science",
    topic: true,
  },
  {
    id: "people",
    kind: "container",
    parentId: "root",
    title: "People, Ethics & Interfaces",
    hue: "lime",
  },
  {
    id: "people-core",
    kind: "container",
    parentId: "people",
    title: "Required",
  },
  {
    id: "cps412",
    kind: "leaf",
    parentId: "people-core",
    title: "CPS 412 Social Issues, Ethics and Professionalism",
    topic: true,
  },
  {
    id: "people-elective",
    kind: "container",
    parentId: "people",
    title: "Elective",
  },
  {
    id: "cps511",
    kind: "leaf",
    parentId: "people-elective",
    title: "CPS 511 Computer Graphics",
    topic: true,
  },
  {
    id: "cps607",
    kind: "leaf",
    parentId: "people-elective",
    title: "CPS 607 Autonomous Mobile Robotics",
    topic: true,
  },
  {
    id: "cps613",
    kind: "leaf",
    parentId: "people-elective",
    title: "CPS 613 Human-Computer Interaction",
    topic: true,
  },
]

/** each course's published topic breakdown, exactly as its outline gives it */
const deep: Record<string, Record<string, DeepSpec>> = {
  cps310: {
    Memory: {
      d: "Where a running program's code and data actually sit, and at what cost to reach them.",
    },
    "CPU Architecture & Instruction Set": {
      d: "The processor's own vocabulary: the operations it offers and the registers it offers them on.",
    },
    "The Instruction Processing Sequence": {
      d: "Fetch, decode, execute — the cycle every instruction passes through.",
    },
    "Assembler-Level Programming": {
      d: "Writing for a specific CPU in its own language, with an assembler and editor, in the lab.",
    },
    "I/O, Interrupts & DMA": {
      d: "How a machine talks to the world without spending all its time asking: interrupts to be told, direct memory access to be spared the copying.",
    },
    "Peripheral Interfaces": {
      d: "The characteristics of the major interfaces a device attaches through.",
    },
    "RISC and CISC Compared": {
      d: "Two answers to how big an instruction set should be, set against each other.",
    },
    "Parallel Processing": {
      d: "More than one thing at once, in hardware.",
    },
  },
  cps412: {
    "Computer Science as a Catalyst": {
      d: "How the discipline came to be, and why it keeps changing faster than almost any other.",
    },
    "Networked Communications": {
      d: "What changes socially once everybody is connected to everybody.",
    },
    "Introduction to Ethics": {
      d: "Theories of ethical decision-making, and applying them to professional life. Two weeks of the term.",
      c: {
        "Analytical Tools": {
          d: "The frameworks used to reason about a case rather than react to it.",
        },
        "Applying Theory to Practice": {
          d: "Taking a framework to an actual professional decision.",
        },
      },
    },
    "Intellectual Property in Canada": {
      d: "Who owns what is created, under this country's law.",
    },
    Privacy: {
      d: "Personal privacy and public safety as competing interests, not a single value.",
    },
    "Computer and Network Security": {
      d: "The vulnerabilities of networked computers, and how they are used for cybercrime, cyber-espionage and cyber-attack.",
    },
    "The Role of the Chief Information Officer": {
      d: "Where technical judgment meets organizational responsibility.",
    },
    "Professional Ethics": {
      d: "The codes of practice a computer scientist is held to.",
    },
    "Equity, Diversity and Inclusion": {
      d: "Who the discipline is built by and for.",
    },
    "Computer Science and the Public Good": {
      d: "What the field owes the society it runs on.",
    },
  },
  cps501: {
    "NCBI Databases": {
      d: "The public genome databases, and the studies built on them.",
      c: {
        "Primary Databases & Metadatabases": {
          d: "Where sequence data is published, and what indexes it.",
        },
        "Genome-Wide Association Studies": {
          d: "Looking across a whole genome for what tracks with a condition — Parkinson's disease as the worked case.",
        },
      },
    },
    "Computational Manipulation of DNA": {
      d: "Treating a genome as a string, and what that buys.",
      c: {
        "String Manipulation in Python": {
          d: "The everyday operations, done in code.",
        },
        "Genetic Screening": {
          d: "Cystic fibrosis screening as the worked case.",
        },
      },
    },
    "Sequence Alignment": {
      d: "Lining two sequences up to see where they agree — the field's central operation.",
      c: {
        "Global and Local Alignment": {
          d: "Aligning whole sequences, or only their best-matching stretches.",
        },
        "The Needleman-Wunsch Algorithm": {
          d: "Dynamic programming over a two-dimensional array; the EMBOSS implementation.",
        },
        "Origin of Influenza Strains": {
          d: "The worked case: where a new strain came from, read off the alignment.",
        },
      },
    },
    "Database Searching & Multiple Alignment": {
      d: "Searching sequence databases for matches, and aligning more than two at once.",
      c: {
        BLAST: {
          d: "Searching for matches fast enough to be usable, by giving up the guarantee of finding the best one.",
        },
        ClustalW: {
          d: "Multiple sequence alignment, with its algorithms and heuristics.",
        },
        "Antibiotic Resistance": {
          d: "The worked case: overuse in agriculture, read in the sequences.",
        },
      },
    },
    "Substitution Matrices & Protein Alignment": {
      d: "Scoring an alignment of proteins, where not all substitutions are equally surprising.",
      c: {
        "Deriving Substitution Matrices": {
          d: "Where the scores come from rather than being assumed.",
        },
        "Nested Hash Tables": {
          d: "The data structure the scoring is carried in.",
        },
      },
    },
    "Molecular Phylogenetics": {
      d: "Distance measurement between sequences, and the trees built from it.",
    },
    "Data Mining": {
      d: "Run alongside the biology all term: class, attribute and instance; 0R and 1R rules; naive Bayes; credibility and accuracy; decision trees.",
    },
  },
  cps506: {
    "Languages Studied": {
      d: "Four languages chosen to span dynamic and static typing and the object-oriented, functional and imperative paradigms. Java, C and C++ serve as reference points.",
      c: {
        Smalltalk: {
          d: "Object-oriented taken all the way down, dynamically typed.",
        },
        Elixir: {
          d: "Functional and concurrent, on the Erlang virtual machine.",
        },
        Haskell: {
          d: "Purely functional, statically typed, lazily evaluated.",
        },
        Rust: {
          d: "Imperative and statically typed, with ownership in place of a garbage collector.",
        },
      },
    },
    "Describing Syntax & Semantics": {
      d: "How a language's form and meaning are written down precisely enough to implement.",
    },
    "Scopes of Names": {
      d: "Which binding a name refers to, and where that is decided.",
    },
    "Data Types": {
      d: "What values a language admits, and how strictly it checks them.",
    },
    "Assignment & Control Structures": {
      d: "Changing state, and choosing what runs next.",
    },
    "Subprograms & Parameter Passing": {
      d: "Decomposing a program, and what actually crosses the boundary on a call.",
    },
    Encapsulation: {
      d: "Drawing a line around a piece of a program and controlling what crosses it.",
    },
    "Object-Oriented Programming": {
      d: "The paradigm as a language design question rather than a style guide.",
    },
    Concurrency: {
      d: "More than one thing in progress, and what the language does about it.",
    },
    "Exception Handling": {
      d: "How a language lets a failure travel.",
    },
  },
  cps510: {
    "Database & DBMS Overview": {
      d: "What a database management system is for, before any particular one. Weeks 1-2.",
    },
    "Database System Architecture": {
      d: "The conceptual, internal and external schemas — three views of one database, and why the separation matters. Weeks 1-2.",
    },
    "Data Modeling & the ER Model": {
      d: "Entities, relationships and the diagram that captures them, before any table exists. Weeks 2-3.",
    },
    "Relational Databases & Normalization": {
      d: "Tables as the implementation, and the discipline that keeps them from contradicting themselves. Weeks 3-4.",
    },
    "Query Languages": {
      d: "Asking the database for what you want rather than telling it how to find it. Weeks 5-7.",
      c: {
        "Relational Algebra": {
          d: "The operations everything else compiles down to.",
        },
        "Relational Calculus": {
          d: "Describing the answer rather than the route to it.",
        },
        "Query by Example": {
          d: "Stating a query by showing a shape of the result.",
        },
        SQL: {
          d: "The one that is actually used, on Oracle, all term.",
        },
      },
    },
    "Functional Dependencies & Normal Forms": {
      d: "What determines what, and the successive forms — up to Boyce-Codd — that follow from it. Weeks 8-10.",
    },
    "Physical Organization & File Management": {
      d: "How the rows actually sit on disk. Weeks 10-12.",
    },
    "User Interfaces & Other Database Types": {
      d: "The front end over the database, and the systems that are not relational. Weeks 11-12, time permitting.",
    },
  },
  cps511: {
    "Software & Hardware Considerations": {
      d: "What the graphics pipeline is made of, in both senses.",
    },
    "Mathematical Manipulation of Graphical Objects": {
      d: "The linear algebra that moves, turns and scales a shape — which is why MTH 108 is a prerequisite.",
    },
    "Representation of 3-D Shapes": {
      d: "How a solid becomes data a machine can draw.",
    },
    "Interactive Graphics & User Interface": {
      d: "Drawing that answers back within a frame.",
    },
    "Fundamental Implementation Algorithms": {
      d: "The classic routines the pipeline is assembled from.",
    },
    "Modern OpenGL": {
      d: "The course's practical half: writing modern OpenGL programs is a stated condition of passing.",
    },
  },
  cps607: {
    "The Nature of Autonomy": {
      d: "What it means for a machine to act on its own, stated carefully enough to build toward.",
    },
    "Autonomous Behaviour": {
      d: "What the machine does once nobody is steering.",
    },
    Sensing: {
      d: "Getting the world into the machine, imperfectly.",
    },
    Actuation: {
      d: "Getting the machine to act on the world, imperfectly.",
    },
    "Building Systems That Interact Independently": {
      d: "The constraints that show up only when a robot has to survive contact with a real environment. Students build working robots.",
    },
  },
  cps613: {
    "Software Engineering": {
      d: "The process half of the course: how a usable interface gets specified, checked and tested. 20 hours.",
      c: {
        "User-Centered Design & Usability Engineering": {
          d: "Designing from the person outward. 1 hour.",
        },
        "Needs Analysis & User Profiles": {
          d: "Finding out who will use it and what for, before designing. 5 hours.",
        },
        "Formative Evaluation": {
          d: "Testing while the design is still changeable. 4 hours.",
        },
        "Usability Testing": {
          d: "The largest single block in the course. 10 hours.",
        },
      },
    },
    "UI Design": {
      d: "The design half: the vocabulary an interface is composed in. 12 hours.",
      c: {
        "Interaction Paradigms": {
          d: "The broad families an interface can belong to. 3 hours.",
        },
        "Conceptual Models & Metaphors": {
          d: "The story the interface tells the user about what it is. 6 hours.",
        },
        "Direct Manipulation, Menu-Forms & Command Line": {
          d: "Three concrete styles, compared. 3 hours.",
        },
      },
    },
    "Cognitive Science": {
      d: "The half that is about the person rather than the machine. 11 hours.",
      c: {
        "Human Information Processing & Perception": {
          d: "What reaches a person, and in what order. 5 hours.",
        },
        Memory: {
          d: "What a person can be expected to hold onto. 3 hours.",
        },
        "Mental Models": {
          d: "The theory a user forms about how the system works, right or wrong. 3 hours.",
        },
      },
    },
    "Visual Studio": {
      d: "The user interface management system the course builds in. 6 hours.",
    },
  },
  cps707: {
    "Statistical Approaches to Testing": {
      d: "Testing treated as sampling, with what that implies about confidence.",
    },
    "Functional Approaches to Testing": {
      d: "Testing against what the software is supposed to do.",
    },
    "Test Data Analysis": {
      d: "Reading what a test run actually told you.",
    },
    Testability: {
      d: "Whether a piece of software can be checked at all, treated as a property to design for.",
    },
    "Static Analysis": {
      d: "Finding faults without running the program.",
    },
    "Dynamic Analysis": {
      d: "Finding faults by running it.",
    },
    "Real-World Applications": {
      d: "Selected current results, and where they have actually been used.",
    },
  },
  cps710: {
    "Introduction & Compilation Phases": {
      d: "History, and the division of the job into phases — interpretation against compilation. 3 hours.",
    },
    Scanning: {
      d: "Turning characters into tokens. 5 hours; Assignment 1 builds one.",
      c: {
        "Finite-State Automata": {
          d: "The machine a scanner really is.",
        },
        "Regular Expressions": {
          d: "The notation those machines are written in.",
        },
      },
    },
    "Parsing & Grammars": {
      d: "Recovering structure from a flat stream of tokens — the largest block in the course at 9 hours. Assignments 2 and 3.",
    },
    "Intermediate Representations": {
      d: "What the front end hands the back end, including the abstract syntax tree. 3 hours.",
    },
    "Semantic Analysis": {
      d: "The checks that a grammar cannot express. 2 hours.",
    },
    Evaluation: {
      d: "Actually running the program that has been read. 6 hours; Assignment 4 builds the interpreter.",
    },
    Scoping: {
      d: "Symbol tables, and which declaration a name resolves to. 5 hours.",
    },
    "Error Detection & Recovery": {
      d: "Reporting a fault usefully, and carrying on to find the next one. 3 hours; the bonus assignment.",
    },
  },
  cps714: {
    "Project Management Basics": {
      d: "The general discipline, before anything specific to software.",
      c: {
        "Context & Processes": {
          d: "What a project is and what running one consists of.",
        },
        "Time, Cost, Quality & Risk": {
          d: "The four things being traded against each other throughout.",
        },
        "Project Plan Analysis": {
          d: "Reading a plan critically rather than following it.",
        },
        "Structures, Teams & Leadership": {
          d: "How the work is arranged, and who answers for it.",
        },
      },
    },
    "Software & IT Project Management": {
      d: "What is different once the project is software.",
      c: {
        "Measurement & Estimation": {
          d: "Software production metrics, and how badly estimation goes without them.",
        },
        "Systems Thinking": {
          d: "Treating the project as a system with feedback rather than a list of tasks.",
        },
        "Uncertainty & the Manager's Role": {
          d: "Planning for what is not yet known.",
        },
        "Governing Rules, Staffing & Operations Reviews": {
          d: "The organizational machinery around the team.",
        },
      },
    },
    "Agile Approaches": {
      d: "The methods, their management, and — deliberately — where they do not apply.",
      c: {
        "Extreme Programming, Scrum & Kanban": {
          d: "Three named methods, compared.",
        },
        "Managing Agile Development": {
          d: "What a manager does when the plan is short by design.",
        },
        "Metrics for Classical and Agile Work": {
          d: "Measuring both kinds with one instrument.",
        },
        "Where Agile Does Not Apply": {
          d: "The outline's own closing note on applicability.",
        },
      },
    },
  },
  cps721: {
    "Deductive Reasoning": {
      d: "Basic logic and resolution-style reasoning, applied to problems such as combinatorial puzzles.",
      c: {
        "Deductive Databases": {
          d: "A relational database augmented with general recursive rules for new relations.",
        },
        "Conjunctive Queries in Prolog": {
          d: "Formulating a query against those facts, and tracing how it is answered.",
        },
      },
    },
    "Recursive Programs over Recursive Data": {
      d: "Writing programs whose shape follows the shape of the data — lists, terms, trees.",
      c: {
        "Prolog Lists": {
          d: "When two lists match and when they do not.",
        },
        "Recursive Data Structures": {
          d: "The general case beyond lists.",
        },
      },
    },
    "Constraint Satisfaction": {
      d: "Finding an assignment that satisfies a set of constraints — scheduling, puzzles — by two different techniques, with the efficiency of each argued rather than asserted.",
    },
    "Natural Language Understanding": {
      d: "Recovering meaning from text, and finding where it is genuinely ambiguous.",
      c: {
        "Context-Free Grammars": {
          d: "Analysing a given grammar.",
        },
        "Parsing Noun Phrases": {
          d: "Parsing, and identifying the sources of syntactic ambiguity.",
        },
      },
    },
    "Problem Solving & Planning": {
      d: "Reaching a goal by searching for a sequence of actions, with preconditions and successor state axioms describing how facts change.",
    },
    "Pruning the Search Space": {
      d: "Not looking where the answer cannot be.",
    },
    "Bayesian Networks": {
      d: "Conditional probabilities for diagnostic reasoning under uncertainty.",
    },
    "Discrete Structures Reinforced": {
      d: "Modular arithmetic, functions and relations, set cardinality and counting, revisited as the AI material needs them.",
    },
  },
  cps730: {
    "Web Components": {
      d: "The pieces the web is assembled from, named before any of them is opened.",
    },
    "Web Clients & Servers": {
      d: "The two ends of every exchange.",
    },
    "Socket Programming": {
      d: "The layer underneath: opening a connection and moving bytes yourself, in Unix.",
    },
    "Web Proxies": {
      d: "The thing in the middle that is neither client nor server.",
    },
    "HTTP, DNS & Other Internet Protocols": {
      d: "The agreements that make the exchange possible.",
    },
    "Serving Multimedia": {
      d: "What changes when the payload is large and time-sensitive.",
    },
    "Web Caching": {
      d: "Not fetching what you already have — the single largest performance lever.",
    },
    "Web Performance Measurement": {
      d: "Measuring it rather than guessing, and characterising the workload that produced the number.",
    },
    "Web Applications & Web 2.0": {
      d: "Web services, social networking and web information retrieval — covered as time allows.",
    },
  },
  cps801: {
    "OS Concepts": {
      d: "What an operating system is for, and the vocabulary the rest of the course uses.",
    },
    "Process Management": {
      d: "Processes and threads: the living things the system schedules and keeps apart.",
    },
    "Memory Management": {
      d: "Dividing one memory among many programs that each believe they have it all.",
    },
    "File Systems": {
      d: "Turning a block device into names, directories and durable content.",
    },
    "I/O & Auxiliary Storage Management": {
      d: "Talking to devices, and managing what does not fit in memory.",
    },
    "Distributed Systems": {
      d: "Covered on remaining time: an operating system spread across machines.",
    },
    "OS Security": {
      d: "Covered on remaining time: the system defending its own separations.",
    },
  },
  cps822: {
    "Propositional Logic": {
      d: "The course starts from the ground up: no previous knowledge of mathematical logic is expected.",
      c: {
        Syntax: {
          d: "Well-formed formulas, sub-formulas, defined connectives.",
        },
        Semantics: {
          d: "Truth assignment, satisfiability, tautology, logical consequence, the well-known equivalences.",
        },
        "Normal Forms": {
          d: "Disjunctive, conjunctive and negation normal form.",
        },
        Resolution: {
          d: "Reasoning by refutation, with its refinements: set-of-support, linear resolution, SLD-resolution, Horn formulas.",
        },
        "Soundness & Completeness": {
          d: "Proving the algorithm both only says true things and eventually says all of them.",
        },
      },
    },
    "First-Order Logic": {
      d: "Quantifiers, and everything that has to be rebuilt once you have them.",
      c: {
        Syntax: {
          d: "Predicate and function symbols, terms, quantifiers, free and bound variables.",
        },
        Semantics: {
          d: "Interpretations, object assignments, models, satisfiability, logical consequence, validity.",
        },
        "Substitution & Unification": {
          d: "Substituting into terms and formulas safely; unifying two terms.",
        },
        "Prenex Normal Form & Skolemization": {
          d: "Pushing the quantifiers out, then removing them.",
        },
        "Herbrand's Theorem": {
          d: "Why resolution over a first-order language terminates when it should.",
        },
        "Godel's Completeness Theorem": {
          d: "Soundness and completeness for first-order logic.",
        },
      },
    },
    "The Situation Calculus": {
      d: "A logic in which actions and the states they produce are themselves objects.",
      c: {
        "The Projection Problem": {
          d: "Whether a state is reachable by a given sequence of actions when the initial state is not fully known.",
        },
        "Regression & Progression": {
          d: "Reasoning backwards from the goal, or forwards from the start.",
        },
        "Precondition & Successor State Axioms": {
          d: "What must hold for an action to happen, and what holds afterwards.",
        },
        "The Frame Problem": {
          d: "Saying succinctly what an action does NOT change.",
        },
      },
    },
    "Planning & Execution Monitoring": {
      d: "Finding a sequence of actions that reaches a goal, and noticing when reality diverges from it. Automated heuristic lifted planning in an open world with unknown objects.",
    },
    "Time & Continuous Processes": {
      d: "Advanced topic: actions that take time, and worlds that change while nothing acts.",
      c: {
        "Instantaneous Actions & Extended Processes": {
          d: "The distinction, and why it matters for the axioms.",
        },
        "Natural Actions": {
          d: "Representing physical law as something that happens on its own; the least natural time point.",
        },
        "Hybrid Systems": {
          d: "Planning, reasoning and diagnosing failure in mixed discrete-continuous systems.",
        },
        Concurrency: {
          d: "Approaches to axiomatizing more than one thing happening at once.",
        },
      },
    },
    "Indirect Effects & Causality": {
      d: "Optional topic: pressing a switch presses the switch, and also turns on the light.",
      c: {
        Circumscription: {
          d: "Minimising what is true; with fixed and variable predicates, and when it can be expressed in first-order logic.",
        },
        "The Ramification & Qualification Problems": {
          d: "Chains of indirect effects, and unstated preconditions.",
        },
        "Causal Rules": {
          d: "Compiling state constraints into successor state axioms through a causality predicate.",
        },
      },
    },
    "Stochastic Actions": {
      d: "Optional topic: actions whose effects are not certain.",
      c: {
        "Markov Decision Processes": {
          d: "Decision-theoretic planning as a formal problem.",
        },
        "Decision-Tree Methods": {
          d: "Solving the finite-horizon decision-theoretic planning problem.",
        },
        "DT-Golog": {
          d: "Representation, semantics, computing a policy and its value, sensing actions, the on-line interpreter; applied to robot programming and requirements engineering.",
        },
      },
    },
    "Taxonomies of Actions": {
      d: "Optional topic: troponyms, the relations between verbs in WordNet's semantic network, and the computational advantage of organising actions that way.",
    },
  },
  cps824: {
    "Introduction to Reinforcement Learning": {
      d: "Learning from consequences rather than from labelled answers. Week 1.",
    },
    "Background Review": {
      d: "Three reviews the course does not assume: weeks 1-3.",
      c: {
        "Probability Theory": {
          d: "Week 1.",
        },
        "Linear Algebra": {
          d: "Week 2.",
        },
        Python: {
          d: "Week 3 — the assignments are programmed in it.",
        },
      },
    },
    "Markov Decision Processes": {
      d: "The formal frame the whole field is stated in. Week 2.",
    },
    "Dynamic Programming": {
      d: "Solving the process when you know it. Week 3.",
      c: {
        "Policy Evaluation": {
          d: "How good is this way of acting?",
        },
        "Policy & Value Iteration": {
          d: "Two routes to the best way of acting.",
        },
      },
    },
    "Q-Learning": {
      d: "Learning the value of an action without a model of the world. Week 4.",
    },
    "Value Function Approximation": {
      d: "What to do when there are too many states to write down. Week 4.",
    },
    "Deep Reinforcement Learning": {
      d: "Weeks 5-6.",
      c: {
        "Deep Learning, CNNs & RNNs": {
          d: "The approximators, introduced for the purpose.",
        },
        "Deep Q-Learning": {
          d: "Q-learning with a network in place of the table.",
        },
      },
    },
    "Imitation Learning": {
      d: "Learning from a demonstration rather than from reward. Week 6.",
    },
    "Policy Gradient": {
      d: "Improving the way of acting directly, rather than through values. Weeks 6-7.",
    },
    "Exploration & Exploitation": {
      d: "Weeks 7-8: the field's defining tension.",
      c: {
        "Multi-Armed Bandits": {
          d: "The tension in its smallest form.",
        },
        "Exploration Strategies": {
          d: "Deciding when to stop taking the known-good option.",
        },
      },
    },
    "Batch Reinforcement Learning": {
      d: "Learning from a fixed log rather than from fresh interaction. Week 8.",
    },
    "Monte Carlo Tree Search": {
      d: "Planning by sampling forward. Week 9.",
    },
    "Inverse Reinforcement Learning": {
      d: "Recovering the reward from the behaviour. Week 9.",
    },
    "Transfer, Multi-Task & Meta-Learning": {
      d: "Carrying what was learned to the next problem. Week 10.",
    },
  },
  cps831: {
    "From the Calendar": {
      d: "What the published calendar entry promises. The outline reproduces it and then says the course will focus elsewhere — the two lists are kept apart here for that reason.",
      c: {
        "Formal Specification": {
          d: "Algebraic and model-oriented specification.",
        },
        "Software Reliability & Fault Tolerance": {
          d: "Carrying on correctly when a part does not.",
        },
        "Tools & Environments": {
          d: "Programming environments, toolkits, method-based environments, development workbenches.",
        },
        "Metrics, Standards & Complexity Measures": {
          d: "Putting numbers on software.",
        },
        "Software Quality Assurance": {
          d: "The discipline around the measurement.",
        },
        "Automated Programming & CASE Tools": {
          d: "Machines writing or shaping the software.",
        },
      },
    },
    "As Actually Taught": {
      d: "The instructor's tentative schedule for the term: advanced software engineering concepts, and a noticeably more modern list.",
      c: {
        "Software Architecture": {
          d: "Basic concepts, views and perspectives, software product lines.",
        },
        "Distributed Computing Architectures": {
          d: "The evolution of cloud and edge computing, and their use in practice.",
        },
        Virtualization: {
          d: "Basic concepts, hypervisors and their types, sample environments.",
        },
        Containers: {
          d: "Container-based design.",
        },
        Microservices: {
          d: "Microservice-based applications.",
        },
        DevOps: {
          d: "Rationale, concepts and practice.",
        },
      },
    },
  },
}

/** the university's own prerequisites. `depends_on` only: the other three
 *  relations this app draws have no counterpart in a course calendar, and an
 *  empty relation is the honest report of that. */
const edges: CorpusSpec['edges'] = [
  {
    source: "cps310",
    target: "cps213",
    type: "depends_on",
  },
  {
    source: "cps501",
    target: "cps118",
    type: "depends_on",
  },
  {
    source: "cps501",
    target: "cps125",
    type: "depends_on",
  },
  {
    source: "cps501",
    target: "cps109",
    type: "depends_on",
  },
  {
    source: "cps501",
    target: "blg143",
    type: "depends_on",
  },
  {
    source: "cps506",
    target: "cps209",
    type: "depends_on",
  },
  {
    source: "cps510",
    target: "cps305",
    type: "depends_on",
  },
  {
    source: "cps511",
    target: "cps305",
    type: "depends_on",
  },
  {
    source: "cps511",
    target: "mth108",
    type: "depends_on",
  },
  {
    source: "cps607",
    target: "cps310",
    type: "depends_on",
  },
  {
    source: "cps613",
    target: "cps209",
    type: "depends_on",
  },
  {
    source: "cps707",
    target: "cps406",
    type: "depends_on",
  },
  {
    source: "cps707",
    target: "cps420",
    type: "depends_on",
  },
  {
    source: "cps707",
    target: "mth210",
    type: "depends_on",
  },
  {
    source: "cps710",
    target: "cps305",
    type: "depends_on",
  },
  {
    source: "cps710",
    target: "coe428",
    type: "depends_on",
  },
  {
    source: "cps710",
    target: "cps420",
    type: "depends_on",
  },
  {
    source: "cps710",
    target: "mth314",
    type: "depends_on",
  },
  {
    source: "cps721",
    target: "cps305",
    type: "depends_on",
  },
  {
    source: "cps721",
    target: "cps420",
    type: "depends_on",
  },
  {
    source: "cps721",
    target: "mth210",
    type: "depends_on",
  },
  {
    source: "cps721",
    target: "mth304",
    type: "depends_on",
  },
  {
    source: "cps730",
    target: "cps393",
    type: "depends_on",
  },
  {
    source: "cps730",
    target: "cps590",
    type: "depends_on",
  },
  {
    source: "cps801",
    target: "cps406",
    type: "depends_on",
  },
  {
    source: "cps801",
    target: "cps590",
    type: "depends_on",
  },
  {
    source: "cps803",
    target: "mth108",
    type: "depends_on",
  },
  {
    source: "cps803",
    target: "mth207",
    type: "depends_on",
  },
  {
    source: "cps803",
    target: "cps305",
    type: "depends_on",
  },
  {
    source: "cps822",
    target: "cps721",
    type: "depends_on",
  },
  {
    source: "cps824",
    target: "cps305",
    type: "depends_on",
  },
  {
    source: "cps824",
    target: "cps420",
    type: "depends_on",
  },
  {
    source: "cps840",
    target: "cps721",
    type: "depends_on",
  },
]

export const COURSES: CorpusSpec = { nodes, deep, edges }
