import { FRAME_BINDING } from "./frame.ts";

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!(gl.getShaderParameter(shader, gl.COMPILE_STATUS) || gl.isContextLost())) {
    throw new Error(`shader did not compile: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

/** Compiles and links at load (a performance rule), and binds the shared frame block. */
export function buildProgram(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("could not create a program");
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!(gl.getProgramParameter(program, gl.LINK_STATUS) || gl.isContextLost())) {
    throw new Error(`program did not link: ${gl.getProgramInfoLog(program)}`);
  }
  const block = gl.getUniformBlockIndex(program, "Frame");
  if (block !== gl.INVALID_INDEX) gl.uniformBlockBinding(program, block, FRAME_BINDING);
  return program;
}
