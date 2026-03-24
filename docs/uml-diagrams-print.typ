#set document(title: "BSI Test Dashboard — UML Diagrams")

// Title page
#page(paper: "a4", margin: 1cm)[
  #align(center + horizon)[
    #text(size: 28pt, weight: "bold")[BSI Test Dashboard]
    #v(1em)
    #text(size: 16pt, fill: rgb("#666"))[UML Diagrams]
  ]
]

// uml-seq-main.svg: 2601x4211 -> portrait
#page(paper: "a4", margin: 1cm)[
  #text(size: 9pt, fill: rgb("#999"))[uml-seq-main]
  #v(0.3em)
  #align(center + horizon)[
    #image("uml-seq-main.svg", width: 100%, height: 100%, fit: "contain")
  ]
]

// uml-states.svg: 3101x2648 -> landscape
#page(paper: "a4", flipped: true, margin: 1cm)[
  #text(size: 9pt, fill: rgb("#999"))[uml-states]
  #v(0.3em)
  #align(center + horizon)[
    #image("uml-states.svg", width: 100%, height: 100%, fit: "contain")
  ]
]
