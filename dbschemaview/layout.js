(function attachLayout(global) {
  "use strict";

  const DEFAULTS = {
    layerGap: 130,
    nodeGap: 34,
    componentGap: 90,
    targetWidth: 1900,
    sweeps: 8,
    refineIterations: 14
  };

  /**
   * 참조 방향(자식 → 부모)을 기준으로 테이블을 왼쪽에서 오른쪽으로 계층 배치한다.
   * 참조되기만 하는 부모 테이블이 왼쪽, 외래키를 가진 자식 테이블이 오른쪽에 온다.
   */
  function layout(nodes, edges, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const positions = new Map();
    if (!nodes.length) return { positions, width: 0, height: 0 };

    const sizes = new Map(nodes.map((node) => [node.id, { width: node.width, height: node.height }]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));
    const undirected = new Map(nodes.map((node) => [node.id, []]));

    for (const edge of edges) {
      if (!sizes.has(edge.from) || !sizes.has(edge.to) || edge.from === edge.to) continue;
      const targets = outgoing.get(edge.from);
      if (!targets.includes(edge.to)) targets.push(edge.to);
      const a = undirected.get(edge.from);
      const b = undirected.get(edge.to);
      if (!a.includes(edge.to)) a.push(edge.to);
      if (!b.includes(edge.from)) b.push(edge.from);
    }

    const components = findComponents(nodes, undirected);
    const placed = components.map((ids) => layoutComponent(ids, outgoing, undirected, sizes, settings));

    packComponents(placed, positions, settings);

    let width = 0;
    let height = 0;
    for (const node of nodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      width = Math.max(width, point.x + sizes.get(node.id).width);
      height = Math.max(height, point.y + sizes.get(node.id).height);
    }

    return { positions, width, height };
  }

  function findComponents(nodes, undirected) {
    const seen = new Set();
    const components = [];

    for (const node of nodes) {
      if (seen.has(node.id)) continue;
      const ids = [];
      const queue = [node.id];
      seen.add(node.id);
      while (queue.length) {
        const current = queue.shift();
        ids.push(current);
        for (const next of undirected.get(current) || []) {
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      components.push(ids);
    }

    // 큰 덩어리를 먼저 배치하고 고립 테이블은 뒤쪽에 격자로 모은다.
    components.sort((a, b) => b.length - a.length);
    return components;
  }

  function assignDepths(ids, outgoing) {
    const member = new Set(ids);
    const depth = new Map();
    const state = new Map();

    function visit(id) {
      const current = state.get(id) || 0;
      if (current === 2) return depth.get(id);
      if (current === 1) return 0; // 순환 참조는 되돌아가는 간선을 끊어서 처리한다.
      state.set(id, 1);
      let best = 0;
      for (const target of outgoing.get(id) || []) {
        if (!member.has(target)) continue;
        best = Math.max(best, visit(target) + 1);
      }
      state.set(id, 2);
      depth.set(id, best);
      return best;
    }

    for (const id of ids) visit(id);
    return depth;
  }

  function orderLayers(layers, crossNeighbors, settings) {
    for (let sweep = 0; sweep < settings.sweeps; sweep += 1) {
      const forward = sweep % 2 === 0;
      const indexes = layers.map((_, index) => index);
      const order = forward ? indexes.slice(1) : indexes.slice(0, -1).reverse();

      for (const layerIndex of order) {
        const reference = layers[forward ? layerIndex - 1 : layerIndex + 1];
        const referencePosition = new Map(reference.map((id, index) => [id, index]));
        const layer = layers[layerIndex];
        const span = Math.max(1, reference.length - 1);
        const selfSpan = Math.max(1, layer.length - 1);

        const scored = layer.map((id, index) => {
          const values = (crossNeighbors.get(id) || [])
            .filter((neighbor) => referencePosition.has(neighbor))
            .map((neighbor) => referencePosition.get(neighbor));
          const barycenter = values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : (index / selfSpan) * span;
          return { id, index, barycenter };
        });

        scored.sort((a, b) => a.barycenter - b.barycenter || a.index - b.index);
        layers[layerIndex] = scored.map((entry) => entry.id);
      }
    }
  }

  function assignVertical(layers, crossNeighbors, sizes, settings) {
    const tops = new Map();

    for (const layer of layers) {
      let cursor = 0;
      for (const id of layer) {
        tops.set(id, cursor);
        cursor += sizes.get(id).height + settings.nodeGap;
      }
    }

    const centerOf = (id) => tops.get(id) + sizes.get(id).height / 2;

    for (let iteration = 0; iteration < settings.refineIterations; iteration += 1) {
      const forward = iteration % 2 === 0;
      const indexes = layers.map((_, index) => index);
      const order = forward ? indexes : indexes.slice().reverse();

      for (const layerIndex of order) {
        const layer = layers[layerIndex];
        const desired = layer.map((id) => {
          const neighbors = (crossNeighbors.get(id) || []).filter((neighbor) => tops.has(neighbor));
          if (!neighbors.length) return centerOf(id);
          return neighbors.reduce((sum, neighbor) => sum + centerOf(neighbor), 0) / neighbors.length;
        });

        // 아래 방향으로 최소 간격을 지키며 배치한다.
        let previousBottom = null;
        for (let k = 0; k < layer.length; k += 1) {
          const id = layer[k];
          const height = sizes.get(id).height;
          let top = desired[k] - height / 2;
          if (previousBottom !== null) top = Math.max(top, previousBottom + settings.nodeGap);
          tops.set(id, top);
          previousBottom = top + height;
        }

        // 위쪽에 여유가 남으면 원하는 위치로 다시 끌어올린다.
        let nextTop = null;
        for (let k = layer.length - 1; k >= 0; k -= 1) {
          const id = layer[k];
          const height = sizes.get(id).height;
          const want = desired[k] - height / 2;
          let top = tops.get(id);
          if (want > top) {
            const limit = nextTop === null ? want : Math.min(want, nextTop - settings.nodeGap - height);
            top = Math.max(top, limit);
            tops.set(id, top);
          }
          nextTop = top;
        }
      }
    }

    return tops;
  }

  function layoutComponent(ids, outgoing, undirected, sizes, settings) {
    const depth = assignDepths(ids, outgoing);
    const maxDepth = Math.max(...ids.map((id) => depth.get(id) || 0));

    const layers = [];
    for (let index = 0; index <= maxDepth; index += 1) layers.push([]);
    for (const id of ids) layers[depth.get(id) || 0].push(id);

    // 같은 레이어 안의 간선은 정렬 신호가 되지 않으므로 제외한다.
    const crossNeighbors = new Map();
    for (const id of ids) {
      const own = depth.get(id) || 0;
      crossNeighbors.set(
        id,
        (undirected.get(id) || []).filter((neighbor) => depth.has(neighbor) && (depth.get(neighbor) || 0) !== own)
      );
    }

    orderLayers(layers, crossNeighbors, settings);
    const tops = assignVertical(layers, crossNeighbors, sizes, settings);

    const layerX = [];
    let cursor = 0;
    for (const layer of layers) {
      layerX.push(cursor);
      const widest = layer.reduce((max, id) => Math.max(max, sizes.get(id).width), 0);
      cursor += widest + settings.layerGap;
    }

    const local = new Map();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    layers.forEach((layer, layerIndex) => {
      for (const id of layer) {
        const point = { x: layerX[layerIndex], y: tops.get(id) };
        local.set(id, point);
        const size = sizes.get(id);
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x + size.width);
        maxY = Math.max(maxY, point.y + size.height);
      }
    });

    for (const point of local.values()) {
      point.x -= minX;
      point.y -= minY;
    }

    return { local, width: maxX - minX, height: maxY - minY };
  }

  function packComponents(components, positions, settings) {
    const target = Math.max(settings.targetWidth, ...components.map((component) => component.width));
    let rowX = 0;
    let rowY = 0;
    let rowHeight = 0;

    for (const component of components) {
      if (rowX > 0 && rowX + component.width > target) {
        rowX = 0;
        rowY += rowHeight + settings.componentGap;
        rowHeight = 0;
      }
      for (const [id, point] of component.local) {
        positions.set(id, { x: rowX + point.x, y: rowY + point.y });
      }
      rowX += component.width + settings.componentGap;
      rowHeight = Math.max(rowHeight, component.height);
    }
  }

  global.DBSchemaLayout = { layout };
})(globalThis);
