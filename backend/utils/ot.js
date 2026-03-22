/**
 * Operational Transform (OT) Algorithm Implementation
 * For real-time collaborative editing
 */

class Operation {
  constructor(type, position, text = '', length = 0) {
    this.type = type; // 'insert' or 'delete'
    this.position = position;
    this.text = text;
    this.length = length;
    this.version = 0;
    this.clientId = '';
    this.timestamp = Date.now();
  }

  static createInsert(pos, text) {
    return new Operation('insert', pos, text);
  }

  static createDelete(pos, length) {
    return new Operation('delete', pos, '', length);
  }

  transformAgainst(other) {
    if (this.type === 'insert' && other.type === 'insert') {
      return this.transformInsertInsert(other);
    } else if (this.type === 'insert' && other.type === 'delete') {
      return this.transformInsertDelete(other);
    } else if (this.type === 'delete' && other.type === 'insert') {
      return this.transformDeleteInsert(other);
    } else if (this.type === 'delete' && other.type === 'delete') {
      return this.transformDeleteDelete(other);
    }
    return this;
  }

  transformInsertInsert(other) {
    if (other.position < this.position) {
      return new Operation('insert', this.position + other.text.length, this.text);
    } else if (other.position === this.position) {
      if (other.clientId < this.clientId) {
        return new Operation('insert', this.position + other.text.length, this.text);
      }
      return this;
    }
    return this;
  }

  transformInsertDelete(other) {
    if (other.position < this.position) {
      return new Operation('insert', this.position - other.length, this.text);
    } else if (other.position <= this.position && this.position < other.position + other.length) {
      return new Operation('insert', other.position, this.text);
    }
    return this;
  }

  transformDeleteInsert(other) {
    if (other.position <= this.position) {
      return new Operation('delete', this.position + other.text.length, '', this.length);
    } else if (this.position < other.position && other.position < this.position + this.length) {
      return new Operation('delete', this.position, '', this.length + other.text.length);
    }
    return this;
  }

  transformDeleteDelete(other) {
    const thisEnd = this.position + this.length;
    const otherEnd = other.position + other.length;

    if (otherEnd <= this.position) {
      return new Operation('delete', this.position - other.length, '', this.length);
    } else if (other.position >= thisEnd) {
      return this;
    }

    if (other.position <= this.position && thisEnd <= otherEnd) {
      return null;
    } else if (this.position < other.position && otherEnd < thisEnd) {
      return new Operation('delete', this.position, '', this.length - other.length);
    } else if (other.position <= this.position && otherEnd <= thisEnd) {
      const newLength = thisEnd - otherEnd;
      return new Operation('delete', other.position, '', newLength);
    } else if (this.position <= other.position && thisEnd <= otherEnd) {
      const newLength = other.position - this.position;
      return new Operation('delete', this.position, '', newLength);
    }

    return this;
  }

  applyToText(text) {
    if (this.type === 'insert') {
      return text.slice(0, this.position) + this.text + text.slice(this.position);
    } else if (this.type === 'delete') {
      return text.slice(0, this.position) + text.slice(this.position + this.length);
    }
    return text;
  }

  clone() {
    return new Operation(this.type, this.position, this.text, this.length);
  }
}

class OperationalTransform {
  constructor() {
    this.operations = [];
    this.version = 0;
    this.clients = new Map();
  }

  applyOperation(operation, clientId) {
    operation.clientId = clientId;
    operation.version = ++this.version;

    let transformedOp = operation.clone();
    for (const pendingOp of this.operations) {
      if (pendingOp.clientId !== clientId) {
        transformedOp = transformedOp.transformAgainst(pendingOp);
        if (!transformedOp) break;
      }
    }

    if (transformedOp) {
      this.operations.push(transformedOp);
      if (this.operations.length > 1000) {
        this.operations = this.operations.slice(-500);
      }
    }

    return transformedOp;
  }

  getOperationsAfterVersion(version) {
    return this.operations.filter(op => op.version > version);
  }

  getCurrentVersion() {
    return this.version;
  }

  applyOperationsToText(text, operations) {
    let result = text;
    const sortedOps = [...operations].sort((a, b) => a.version - b.version);
    
    for (const op of sortedOps) {
      if (op) {
        result = op.applyToText(result);
      }
    }
    return result;
  }

  rebaseOperations(clientOps, currentText) {
    const rebasedOps = [];
    let currentVersion = this.version;
    
    for (const op of clientOps) {
      let transformedOp = op.clone();
      for (const serverOp of this.operations) {
        if (serverOp.version > op.version) {
          transformedOp = transformedOp.transformAgainst(serverOp);
          if (!transformedOp) break;
        }
      }
      
      if (transformedOp) {
        transformedOp.version = ++currentVersion;
        rebasedOps.push(transformedOp);
      }
    }
    
    return rebasedOps;
  }
}

module.exports = { Operation, OperationalTransform };