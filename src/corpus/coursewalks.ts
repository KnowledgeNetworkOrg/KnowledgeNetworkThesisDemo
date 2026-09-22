// GENERATED FILE — DO NOT EDIT BY HAND.
// Authored routes through the course corpus — every step a published prerequisite.
//
// Written by `node tools/courseimport/generate.mjs` from
// `tools/courseimport/courses.json`, which is the file to change. The JSON is a
// hand-reviewed reading of Toronto Metropolitan University's published Computer
// Science course outlines; `tools/courseimport/README.md` records where every
// field came from and which judgments are the author's rather than the
// university's.

import type { Walk } from './walks'

export const COURSE_WALKS: Walk[] = [
  {
    id: "required-spine",
    title: "The required spine of the degree",
    description: "The prerequisite chain every Computer Science student walks, from the first programming course to the upper-year required courses that rest on it. Every step here is a published prerequisite, not a suggestion.",
    stops: [
      {
        id: "cps109",
        note: "Where it starts. Everything downstream assumes you can program.",
      },
      {
        id: "cps209",
        note: "The second programming course — the prerequisite named most often by everything above it.",
      },
      {
        id: "cps305",
        note: "Data Structures. Four of the outlined courses name this directly; nothing in the upper years is reachable without it.",
      },
      {
        id: "cps420",
        note: "Discrete Structures. The other half of the gate: the mathematics the AI, compiler and verification courses all assume.",
      },
      {
        id: "cps213",
        note: "A parallel branch, not a continuation — hardware runs alongside the programming chain rather than after it.",
      },
      {
        id: "cps310",
        note: "Computer Organization II continues CPS 213, and is what the robotics course stands on.",
      },
      {
        id: "cps590",
        note: "Operating Systems I. With CPS 406, the gate to the systems electives.",
      },
      {
        id: "cps406",
        note: "Introduction to Software Engineering — required, and the prerequisite of both the verification and the advanced operating systems courses.",
      },
    ],
  },
  {
    id: "toward-ai",
    title: "Getting to artificial intelligence",
    description: "What a student must have done before the AI courses will admit them, and how far the subject then goes. The path is read off the published prerequisites; the last two courses are where it ends.",
    stops: [
      {
        id: "cps305",
        note: "Data structures first — the AI courses are built on recursive structures over lists and trees.",
      },
      {
        id: "cps420",
        note: "Discrete structures: logic, relations, counting. CPS 721 reinforces these rather than teaching them.",
      },
      {
        id: "cps721",
        note: "Artificial Intelligence I. Reasoning, constraints, search, language, planning and Bayesian networks, in Prolog.",
      },
      {
        id: "cps822",
        note: "Artificial Intelligence II names CPS 721 as its prerequisite, then rebuilds logic from scratch anyway — propositional, then first-order, then the situation calculus.",
      },
      {
        id: "cps824",
        note: "Reinforcement Learning takes the other fork out of CPS 305 and CPS 420: decisions under uncertainty rather than deduction.",
      },
      {
        id: "cps840",
        note: "And Selected Topics, which in Fall 2018 was Machine Learning — the same document as CPS 803, under a different number and a different prerequisite.",
      },
    ],
  },
  {
    id: "software-practice",
    title: "Learning to build software with other people",
    description: "The software engineering track: the required introduction, then the three electives that follow it. Notable for what the graph shows — two of the three publish no prerequisite at all.",
    stops: [
      {
        id: "cps209",
        note: "You can program.",
      },
      {
        id: "cps406",
        note: "Introduction to Software Engineering — the one required course of the track, and a prerequisite of CPS 707 and CPS 801.",
      },
      {
        id: "cps707",
        note: "Software Verification and Validation: CPS 406 plus discrete structures. Static analysis, dynamic analysis, testability.",
      },
      {
        id: "cps714",
        note: "Software Project Management states no prerequisite in its outline — it hangs unconnected in the graph, which is a fact about the published record, not a gap in the data.",
      },
      {
        id: "cps831",
        note: "Software Engineering II, also with no stated prerequisite. Its calendar entry and what the instructor actually taught are two visibly different lists.",
      },
    ],
  },
]
