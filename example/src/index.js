'use strict';

const d3 = require('d3'),
      graph = require('../../lib/graph'),
      katz = require('../../lib/network/centrality/katz'),
      renderer = require('./renderer');

class Filter {
  constructor(values) {
    const vertices = Object.keys(values);
    this.threshold = 0;
    this.length = vertices.length;
    this.order = {};
    vertices.sort((u, v) => values[u] - values[v]);
    for (let i = 0; i < this.length; ++i) {
      this.order[vertices[i]] = i + 1;
    }
  }

  call(u) {
    return this.order[u] >= this.threshold * this.length;
  }
}

d3.json('data/graph5.json', (data) => {
  const g = graph();
  for (const node of data.nodes) {
    g.addVertex(node);
  }
  for (const link of data.links) {
    if (link.source !== link.target) {
      g.addEdge(link.source, link.target);
    }
  }

  const filter = new Filter(katz(g));

  const r = renderer({
    vertexWidth: ({d}) => Math.min(d.text.length, 20) * 8,
    vertexHeight: () => 12,
    vertexColor: ({d}) => d.color || '#ccc',
    vertexVisibility: ({u}) => filter.call(u),
    xMargin: 30,
    yMargin: 3,
    edgeMargin: 3,
    ltor: true
  });

  const selection = d3.select('#screen')
    .attr({
      transform: 'scale(0.3)',
      width: 10000,
      height: 10000
    });
  selection
    .datum(g)
    .transition()
    .duration(1000)
    .delay(1000)
    .call(r);

  d3.select('#update-button')
    .on('click', () => {
      const threshold = +d3.select('#threshold').node().value,
            delay = threshold <= 0.2 ? 800 : 400;
      filter.threshold = threshold;
      selection
        .transition()
        .duration(1000)
        .delay(delay)
        .call(r);
    });
});
