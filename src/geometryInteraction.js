function vectorLength(vector) {
  return Math.hypot(...vector);
}

function fallbackPerpendicular(axis) {
  const reference = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = [
    axis[1] * reference[2] - axis[2] * reference[1],
    axis[2] * reference[0] - axis[0] * reference[2],
    axis[0] * reference[1] - axis[1] * reference[0]
  ];
  const length = vectorLength(cross);
  return cross.map((value) => value / length);
}

function axisFrame(lineStart, lineEnd) {
  const axis = lineEnd.map((value, index) => Number(value) - Number(lineStart[index]));
  const axisLength = vectorLength(axis);
  if (axisLength < 1e-9) return null;
  const unitAxis = axis.map((value) => value / axisLength);
  const reference = Math.abs(unitAxis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const projection = reference.reduce((sum, value, index) => sum + value * unitAxis[index], 0);
  const firstBasisRaw = reference.map((value, index) => value - projection * unitAxis[index]);
  const firstBasisLength = vectorLength(firstBasisRaw);
  const firstBasis = firstBasisRaw.map((value) => value / firstBasisLength);
  const secondBasis = [
    unitAxis[1] * firstBasis[2] - unitAxis[2] * firstBasis[1],
    unitAxis[2] * firstBasis[0] - unitAxis[0] * firstBasis[2],
    unitAxis[0] * firstBasis[1] - unitAxis[1] * firstBasis[0]
  ];
  return { unitAxis, firstBasis, secondBasis };
}

export function projectPointToLineDistance({ point, lineStart, lineEnd, distance }) {
  const targetDistance = Number(distance);
  if (![point, lineStart, lineEnd].every((item) => Array.isArray(item) && item.length >= 3)
    || !Number.isFinite(targetDistance)
    || targetDistance < 0) {
    return null;
  }

  const axis = lineEnd.map((value, index) => Number(value) - Number(lineStart[index]));
  const axisLengthSquared = axis.reduce((sum, value) => sum + value * value, 0);
  if (axisLengthSquared < 1e-12) return null;

  const fromStart = point.map((value, index) => Number(value) - Number(lineStart[index]));
  const parameter = fromStart.reduce((sum, value, index) => sum + value * axis[index], 0) / axisLengthSquared;
  const foot = lineStart.map((value, index) => Number(value) + parameter * axis[index]);
  const radial = point.map((value, index) => Number(value) - foot[index]);
  const radialLength = vectorLength(radial);
  const direction = radialLength > 1e-9
    ? radial.map((value) => value / radialLength)
    : fallbackPerpendicular(axis.map((value) => value / Math.sqrt(axisLengthSquared)));

  return foot.map((value, index) => value + targetDistance * direction[index]);
}

export function applySpatialPointControl({ point, lineStart, lineEnd, distance, kind, value }) {
  const frame = axisFrame(lineStart, lineEnd);
  const targetDistance = Number(distance);
  const controlValue = Number(value);
  if (!frame || !Number.isFinite(targetDistance) || !Number.isFinite(controlValue)) return null;

  const fromStart = point.map((coordinate, index) => Number(coordinate) - Number(lineStart[index]));
  const currentAxial = fromStart.reduce((sum, coordinate, index) => sum + coordinate * frame.unitAxis[index], 0);
  const axial = kind === "axial" ? controlValue : currentAxial;
  const foot = lineStart.map((coordinate, index) => Number(coordinate) + axial * frame.unitAxis[index]);

  if (kind === "rotation") {
    const radians = controlValue * Math.PI / 180;
    return foot.map((coordinate, index) => coordinate + targetDistance * (
      Math.cos(radians) * frame.firstBasis[index] + Math.sin(radians) * frame.secondBasis[index]
    ));
  }

  if (kind === "axial") {
    const radial = point.map((coordinate, index) => Number(coordinate) - (
      Number(lineStart[index]) + currentAxial * frame.unitAxis[index]
    ));
    const radialLength = vectorLength(radial);
    const direction = radialLength > 1e-9
      ? radial.map((coordinate) => coordinate / radialLength)
      : frame.firstBasis;
    return foot.map((coordinate, index) => coordinate + targetDistance * direction[index]);
  }

  return null;
}

export function getSpatialPointControlValues({ point, lineStart, lineEnd }) {
  const frame = axisFrame(lineStart, lineEnd);
  if (!frame || !Array.isArray(point)) return null;
  const fromStart = point.map((coordinate, index) => Number(coordinate) - Number(lineStart[index]));
  const axial = fromStart.reduce((sum, coordinate, index) => sum + coordinate * frame.unitAxis[index], 0);
  const radial = fromStart.map((coordinate, index) => coordinate - axial * frame.unitAxis[index]);
  const first = radial.reduce((sum, coordinate, index) => sum + coordinate * frame.firstBasis[index], 0);
  const second = radial.reduce((sum, coordinate, index) => sum + coordinate * frame.secondBasis[index], 0);
  return {
    axial: Number(axial.toFixed(4)),
    rotation: Number((Math.atan2(second, first) * 180 / Math.PI).toFixed(4))
  };
}
