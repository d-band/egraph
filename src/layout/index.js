'use strict';

import graph from '../graph';
import defineAccessors from '../utils/define-accessors';
import cycleRemoval from './cycle-removal';
import layerAssignment from './layer-assignment';
import normalize from './normalize';
import crossingReduction from './crossing-reduction';
import positionAssignment from './position-assignment';

const initGraph = (gOrig, {ltor, width, height, layerMargin, vertexMargin}) => {
  const g = graph();
  for (const u of gOrig.vertices()) {
    const uNode = gOrig.vertex(u),
          w = width({u, d: uNode}),
          h = height({u, d: uNode});
    g.addVertex(u, {
      width: ltor ? h + vertexMargin : w + layerMargin,
      height: ltor ? w + layerMargin : h + vertexMargin,
      origWidth: ltor ? h : w,
      origHeight: ltor ? w : h
    });
  }
  for (const [u, v] of gOrig.edges()) {
    g.addEdge(u, v);
  }
  return g;
};

const simplify = (points, ltor) => {
  let index = 1;
  while (index < points.length - 1) {
    const x0 = ltor ? points[index][1] : points[index][0],
          x1 = ltor ? points[index + 1][1] : points[index + 1][0];
    if (x0 === x1) {
      points.splice(index, 2);
    } else {
      index += 2;
    }
  }
};

const buildResult = (g, layers, ltor) => {
  const result = {
          vertices: {},
          edges: {}
        },
        layerHeights = [];

  for (const layer of layers) {
    let maxHeight = -Infinity;
    for (const u of layer) {
      maxHeight = Math.max(maxHeight, g.vertex(u).origHeight || 0);
    }
    layerHeights.push(maxHeight);
  }

  for (let i = 0; i < layers.length; ++i) {
    const layer = layers[i],
          layerHeight = layerHeights[i];
    for (const u of layer) {
      const uNode = g.vertex(u);
      if (!uNode.dummy) {
        result.vertices[u] = {
          x: ltor ? uNode.y : uNode.x,
          y: ltor ? uNode.x : uNode.y,
          width: ltor ? uNode.origHeight : uNode.origWidth,
          height: ltor ? uNode.origWidth : uNode.origHeight,
          layer: uNode.layer,
          order: uNode.order
        };

        if (result.edges[u] === undefined) {
          result.edges[u] = {};
        }

        for (const v of g.outVertices(u)) {
          const points = ltor
            ? [[uNode.y + (uNode.origHeight || 0) / 2, uNode.x], [uNode.y + layerHeight / 2, uNode.x]]
            : [[uNode.x, uNode.y + (uNode.origHeight || 0) / 2], [uNode.x, uNode.y + layerHeight / 2]];
          let w = v,
              wNode = g.vertex(w),
              j = i + 1;
          while (wNode.dummy) {
            if (ltor) {
              points.push([wNode.y - layerHeights[j] / 2, wNode.x]);
              points.push([wNode.y + layerHeights[j] / 2, wNode.x]);
            } else {
              points.push([wNode.x, wNode.y - layerHeights[j] / 2]);
              points.push([wNode.x, wNode.y + layerHeights[j] / 2]);
            }
            w = g.outVertices(w)[0];
            wNode = g.vertex(w);
            j += 1;
          }
          if (ltor) {
            points.push([wNode.y - layerHeights[j] / 2, wNode.x]);
            points.push([wNode.y - (wNode.origHeight || 0) / 2, wNode.x]);
          } else {
            points.push([wNode.x, wNode.y - layerHeights[j] / 2]);
            points.push([wNode.x, wNode.y - (wNode.origHeight || 0) / 2]);
          }
          simplify(points, ltor);
          result.edges[u][w] = {
            points: points
          };
        }
      }
    }
  }

  return result;
};

const groupLayers = (g, layers) => {
  const result = [];
  for (const u of g.vertices()) {
    const layer = layers[u];
    if (result[layer] === undefined) {
      result[layer] = [];
    }
    result[layer].push(u);
  }
  return result;
};

const defaultOptions = {
  width: ({d}) => d.width,
  height: ({d}) => d.height,
  layerMargin: 10,
  vertexMargin: 10,
  edgeMargin: 10,
  ltor: true,
  cycleRemoval: cycleRemoval,
  layerAssignment: layerAssignment.quadHeuristic,
  crossingReduction: crossingReduction,
  positionAssignment: positionAssignment
};

class Layouter {
  constructor() {
    defineAccessors(this, {}, defaultOptions);
  }

  layout(gOrig) {
    const g = initGraph(gOrig, {
      width: this.width(),
      height: this.height(),
      layerMargin: this.layerMargin(),
      vertexMargin: this.vertexMargin(),
      ltor: this.ltor()
    });
    this.cycleRemoval()(g);
    const layerMap = this.layerAssignment()(g);
    const layers = groupLayers(g, layerMap);
    normalize(g, layers, layerMap, this.edgeMargin());
    this.crossingReduction()(g, layers);
    for (let i = 0; i < layers.length; ++i) {
      const layer = layers[i];
      for (let j = 0; j < layer.length; ++j) {
        const u = layer[j];
        g.vertex(u).layer = i;
        g.vertex(u).order = j;
      }
    }
    this.positionAssignment()(g, layers);
    return buildResult(g, layers, this.ltor());
  }
}

export default Layouter;
