import {
  uid,
  loadText
} from "./utils.mjs";

/**
 * A renderer program
 * @class Program
 */
class Program {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor({ gl, logLevel } = opts) {
    this.uid = uid();
    this.gl = gl;
    this.ready = false;
    this.native = null;
    this.onload = null;
    this.sources = {
      vertex: null,
      fragment: null
    };
    this.name = "";
    this.variables = {};
    this.definitions = {};
    this.logLevel = Program.LOG_LEVEL_DEFAULT;
    if (logLevel) this.logLevel = logLevel;
  }
};

/**
 * Indicates if we do verbose logging or not
 * @return {Boolean}
 */
Program.prototype.useVerboseLogging = function() {
  return this.logLevel === Program.LOG_LEVEL_VERBOSE;
};

/**
 * Loads the program's source by the given path
 * @param {String} path
 * @return {Promise}
 */
Program.prototype.fromPath = function(path) {
  return new Promise(resolve => {
    loadText(path + ".vert").then(vertexSrc => {
      loadText(path + ".frag").then(fragmentSrc => {
        let status = this.buildFromSource(vertexSrc, fragmentSrc);
        if (!status) {
          if (this.useVerboseLogging()) console.warn(`Invalid GL program!`);
          return;
        }
        if (this.onload instanceof Function) this.onload(this);
        resolve(this);
      });
    });
  });
};

/**
 * Loads the program's source by the given path
 * @param {String} vertexSrc
 * @param {String} fragmentSrc
 * @return {Promise}
 */
Program.prototype.fromSource = function(vertexSrc, fragmentSrc) {
  return new Promise(resolve => {
    let status = this.buildFromSource(vertexSrc, fragmentSrc);
    if (!status) {
      if (this.useVerboseLogging()) console.warn(`Invalid GL program!`);
      return;
    }
    if (this.onload instanceof Function) this.onload(this);
    resolve(this);
  });
};

/**
 * Build's the program with the given shader sources
 * @param {String} vertexSrc
 * @param {String} fragmentSrc
 */
Program.prototype.buildFromSource = function(vertexSrc, fragmentSrc) {
  let {sources} = this;
  sources.vertex = vertexSrc;
  sources.fragment = fragmentSrc;
  return this.build();
};

/**
 * Builds the shader program
 * Compile shaders, resolve & link variables
 */
Program.prototype.build = function() {
  let {gl} = this;
  let {vertex, fragment} = this.sources;
  this.native = gl.createProgram();
  let vxStatus = this.compileShader(vertex, gl.VERTEX_SHADER);
  let fgStatus = this.compileShader(fragment, gl.FRAGMENT_SHADER);
  gl.linkProgram(this.native);
  this.resolveVariables(vertex);
  this.resolveVariables(fragment);
  this.ready = true;
  return vxStatus && fgStatus;
};

/**
 * Extracts and links the variables of a shader source
 * @param {String} source - Shader source
 */
Program.prototype.resolveVariables = function(source) {
  let variables = this.extractVariables(source);
  this.linkVariables(variables);
};

/**
 * Extract variables from a shader source
 * @param {String} source
 * @return {Object} Extracted shader variables
 */
Program.prototype.extractVariables = function(source) {
  let regexp = /(uniform|attribute|in|flat in) (.*) (.*);/g;
  let match = null;
  let variables = {};
  while (match = regexp.exec(source)) {
    let qualifier = match[1].trim();
    let type = match[2].trim();
    let name = match[3].trim();
    variables[name] = {
      qualifier: Program.getVariableBit(qualifier),
      type: Program.getVariableBit(type),
      location: null
    };
  };
  return variables;
};

/**
 * Links the shader variables to the program
 * @param {Object} variables
 */
Program.prototype.linkVariables = function(variables) {
  let {gl, native} = this;
  for (let name in variables) {
    let vari = variables[name];
    let location = null;
    switch (vari.qualifier) {
      case Program.UNIFORM:
        location = gl.getUniformLocation(native, name);
      break;
      case Program.ATTRIBUTE:
        location = gl.getAttribLocation(native, name);
      break;
    };
    if (location === null) {
      if (this.useVerboseLogging()) console.warn(`Variable '${name}' is not defined or de-optimized!`);
    }
    vari.location = location;
    this.variables[name] = vari;
  };
};

/**
 * Upload something to the shader
 * @param {String} name - Variable name
 * @param {*} data
 */
Program.prototype.set = function(name, data) {
  let {gl} = this;
  let def = this.variables[name] || null;
  if (def !== null && def.qualifier === Program.UNIFORM) {
    if (def.type === Program.INT)               gl.uniform1i(def.location, data);
    else if (def.type === Program.FLOAT)        gl.uniform1f(def.location, data);
    else if (def.type === Program.F_VEC_2)      gl.uniform2fv(def.location, data);
    else if (def.type === Program.F_VEC_3)      gl.uniform3fv(def.location, data);
    else if (def.type === Program.F_VEC_4)      gl.uniform4fv(def.location, data);
    else if (def.type === Program.I_VEC_2)      gl.uniform2iv(def.location, data);
    else if (def.type === Program.I_VEC_3)      gl.uniform3iv(def.location, data);
    else if (def.type === Program.I_VEC_4)      gl.uniform4iv(def.location, data);
    else if (def.type === Program.F_MAT_2)      gl.uniformMatrix2fv(def.location, false, data);
    else if (def.type === Program.F_MAT_3)      gl.uniformMatrix3fv(def.location, false, data);
    else if (def.type === Program.F_MAT_4)      gl.uniformMatrix4fv(def.location, false, data);
    else if (def.type === Program.SAMPLER_2D)   gl.uniform1i(def.location, data);
    else if (def.type === Program.SAMPLER_3D)   gl.uniform1i(def.location, data);
    else if (def.type === Program.SAMPLER_CUBE) gl.uniform1i(def.location, data);
    else if (def.type === Program.BOOL)         gl.uniform1i(def.location, data);
    else if (def.type === Program.B_VEC_2)      gl.uniform2iv(def.location, data);
    else if (def.type === Program.B_VEC_3)      gl.uniform3iv(def.location, data);
    else if (def.type === Program.B_VEC_4)      gl.uniform4iv(def.location, data);
    else {
      console.warn(`Invalid shader variable access - Uniform ${name} doesn't exist!`);
    }
  }
};

/**
 * Makes a constant define to the shader
 * @param {String} name - Variable name
 * @param {*} data
 */
Program.prototype.define = function(name, data) {
  if (typeof name === "object") {
    for (let key in name) this.define(key, name[key]);
    return;
  }
  let {definitions} = this;
  let def = this.variables[name] || null;
  if (def !== null && def.qualifier === Program.UNIFORM) {
    definitions[name] = data;
  }
};

/**
 * Flushes all constant definitions
 */
Program.prototype.flush = function() {
  let {definitions} = this;
  for (let name in definitions) {
    let data = definitions[name];
    this.set(name, data);
  };
};

/**
 * Compile the given shader
 * @param {String} shaderSrc
 * @param {Number} shaderType
 * @return {WebGLShader}
 */
Program.prototype.compileShader = function(shaderSrc, shaderType) {
  let {gl, native} = this;
  let shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSrc);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Shader compile error:` + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  gl.attachShader(native, shader);
  return shader;
};

/**
 * Returns enum value of given string
 * @param {String} type
 * @return {Number}
 */
Program.getVariableBit = function(type) {
  switch (type) {
    case "int":         return Program.INT;
    case "bool":        return Program.BOOL;
    case "float":       return Program.FLOAT;
    case "vec2":        return Program.F_VEC_2;
    case "vec3":        return Program.F_VEC_3;
    case "vec4":        return Program.F_VEC_4;
    case "ivec2":       return Program.I_VEC_2;
    case "ivec3":       return Program.I_VEC_3;
    case "ivec4":       return Program.I_VEC_4;
    case "bvec2":       return Program.B_VEC_2;
    case "bvec3":       return Program.B_VEC_3;
    case "bvec4":       return Program.B_VEC_4;
    case "mat2":        return Program.F_MAT_2;
    case "mat3":        return Program.F_MAT_3;
    case "mat4":        return Program.F_MAT_4;
    case "uniform":     return Program.UNIFORM;
    case "sampler2D":   return Program.SAMPLER_2D;
    case "sampler3D":   return Program.SAMPLER_3D;
    case "samplerCube": return Program.SAMPLER_CUBE;
    case "attribute":   return Program.ATTRIBUTE;
    case "in":          return Program.ATTRIBUTE;
  };
  return Program.UNKNOWN;
};

/**
 * Returns the size of an variable
 * @param {Number} bit - The variable bit
 * @return {Number} The variable size
 */
Program.getVariableSize = function(bit) {
  switch (bit) {
    case Program.INT:     return 1;
    case Program.BOOL:    return 1;
    case Program.FLOAT:   return 1;

    case Program.F_VEC_2: return 2;
    case Program.F_VEC_3: return 3;
    case Program.F_VEC_4: return 4;

    case Program.I_VEC_2: return 2;
    case Program.I_VEC_3: return 3;
    case Program.I_VEC_4: return 4;

    case Program.B_VEC_2: return 2;
    case Program.B_VEC_3: return 3;
    case Program.B_VEC_4: return 4;

    case Program.F_MAT_2: return 2 * 2;
    case Program.F_MAT_3: return 3 * 3;
    case Program.F_MAT_4: return 4 * 4;
  };
  return Program.UNKNOWN;
};

Program.prototype.getGLTypeFromTypedArray = function(data) {
  let {gl} = this;
  let ctor = data.constructor;
  switch (ctor) {
    case Int8Array:    return gl.BYTE;
    case Int16Array:   return gl.SHORT;
    case Int32Array:   return gl.INT;
    case Float32Array: return gl.FLOAT;
    case Uint8Array:   return gl.UNSIGNED_BYTE;
    case Uint16Array:  return gl.UNSIGNED_SHORT;
    case Uint32Array:  return gl.UNSIGNED_INT;
  };
  if (this.useVerboseLogging()) console.warn(`Cannot resolve GL type equivalent for`, data);
  return Program.UNKNOWN;
};

Program.getNativeTypeFromGLVariable = function(vari) {
  let {type} = vari;
  switch (type) {
    case Program.INT:
    case Program.BOOL:
    case Program.FLOAT:
      return Program.NUMBER;
    case Program.F_VEC_2:
    case Program.F_VEC_3:
    case Program.F_VEC_4:
    case Program.F_MAT_2:
    case Program.F_MAT_3:
    case Program.F_MAT_4:
    case Program.I_VEC_2:
    case Program.I_VEC_3:
    case Program.I_VEC_4:
    case Program.B_VEC_2:
    case Program.B_VEC_3:
    case Program.B_VEC_4:
      return Program.ARRAY;
  };
  return Program.UNKNOWN;
};

// types
{
  let idx = 0;
  Program.UNKNOWN =      idx++;

  Program.INT =          0x1404;
  Program.BOOL =         0x8B56;
  Program.FLOAT =        0x1406;

  Program.F_VEC_2 =      0x8B50;
  Program.F_VEC_3 =      0x8B51;
  Program.F_VEC_4 =      0x8B52;

  Program.I_VEC_2 =      0x8B53;
  Program.I_VEC_3 =      0x8B54;
  Program.I_VEC_4 =      0x8B55;

  Program.B_VEC_2 =      0x8B57;
  Program.B_VEC_3 =      0x8B58;
  Program.B_VEC_4 =      0x8B59;

  Program.F_MAT_2 =      0x8B5A;
  Program.F_MAT_3 =      0x8B5B;
  Program.F_MAT_4 =      0x8B5C;

  Program.SAMPLER_2D =   0x8B5E;
  Program.SAMPLER_3D =   0x8B5E;
  Program.SAMPLER_CUBE = 0x8B60;

  Program.UNIFORM =      idx++;
  Program.ATTRIBUTE =    idx++;

  Program.ARRAY = idx++;
  Program.NUMBER = idx++;
}

// log levels
{
  let idx = 0;
  Program.LOG_LEVEL_DEFAULT = idx++;
  Program.LOG_LEVEL_VERBOSE = idx++;
}

export default Program;
