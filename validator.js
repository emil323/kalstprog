const Ajv = require('Ajv')
const ajv = new Ajv()

const valid_filename = '^[^\\/:"*?<>|]+$'


const schema_create_project = {
  'type': 'object',
  'required':['project_name'],
  'properties': {
    'project_name': {
      'type':'string',
      'minLength':3,
      'maxLength':50,
      'pattern': valid_filename //Så får vi kompabilitet hele veien
    }
  }
}

/*
{ scope: 'event_handler',
  cmd: 'subscribe',
  project_id: 'a3e6fec3-19be-487a-95ff-83644d9f5da2',
  active: true }
*/

const schema_event_subscribe = {
  'type': 'object',
  'required': ['scope','cmd','project_id', 'active'],
  'properties': {
    'scope': {'type':'string'},
    'cmd': { 'type': 'string' },
    'project_id': { 'type': 'string' },
    'active': {'type': 'boolean'}
  }
}

/*
{ scope: 'event_handler',
  cmd: 'update_connection_status',
  active: false }
*/

const schema_event_update_connection_status = {
  'type': 'object',
  'required': ['scope','cmd','active'],
  'properties': {
    'scope': {'type':'string'},
    'cmd': { 'type': 'string' },
    'active': {'type': 'boolean'},
    'user_id': {'type': 'string'}
  }
}

/*
{ scope: 'chat', msg: 'lol' }
*/

const schema_chat = {
  'type': 'object',
  'required': ['scope','msg'],
  'properties': {
    'scope': {'type':'string'},
    'msg': { 'type': 'string', 'minLength': 1, 'maxLength':255}
  }
}

/*
{ scope: 'editor',
  cmd: 'attach',
  object_id: '8281e991-f5a4-4811-84ea-3bc710404b0a',
  active: true }
*/

const schema_editor_attach = {
  'type': 'object',
  'required': ['scope','cmd','object_id'],
  'properties': {
    'scope': {'type':'string'},
    'cmd': { 'type': 'string' },
    'active': {'type': 'boolean'}
  }
}

/*
  { scope: 'editor',
  cmd: 'detach',
  object_id: '8281e991-f5a4-4811-84ea-3bc710404b0a' }
*/

const schema_editor_detach = {
  'type': 'object',
  'required': ['scope','cmd','object_id'],
  'properties': {
    'scope': {'type':'string'},
    'cmd': { 'type': 'string' }
  }
}

/*
{ scope: 'editor',
  cmd: 'insert',
  object_id: '8281e991-f5a4-4811-84ea-3bc710404b0a',
  tick: 0,
  start: { row: 5, column: 0 },
  end: { row: 5, column: 1 },
  lines: [ 'f' ] }
*/

const schema_editor_insert = {
  'type': 'object',
  'required': ['scope','cmd','object_id', 'tick', 'start', 'end', 'lines'],
  'properties': {
    'scope': {'type':'string'},
    'cmd': { 'type': 'string' },
    'object_id': {'type': 'string'},
    'tick': {'type':'number'},
    'start': {
      'type':'object',
      'required' : ['row','column'],
      'properties': {
        'row': {'type':'number'},
        'column': {'type':'number'}
      }
    },
    'end': {
      'type':'object',
      'required' : ['row','column'],
      'properties': {
        'row': {'type':'number'},
        'column': {'type':'number'}
      }
    },
    'lines': {'type':'array'}
  }
}

/*
  { scope: 'editor',
  cmd: 'remove',
  object_id: '8281e991-f5a4-4811-84ea-3bc710404b0a',
  tick: 0,
  start: { row: 5, column: 7 },
  end: { row: 5, column: 8 },
  lines: [ '9' ] }
*/

const schema_editor_remove = {
  'type': 'object',
  'required': ['scope','cmd','object_id', 'tick', 'start', 'end'],
  'properties': {
    'scope': {'type':'string'},
    'cmd': { 'type': 'string' },
    'object_id': {'type': 'string'},
    'tick': {'type':'number'},
    'start': {
      'type':'object',
      'required' : ['row','column'],
      'properties': {
        'row': {'type':'number'},
        'column': {'type':'number'}
      }
    },
    'end': {
      'type':'object',
      'required' : ['row','column'],
      'properties': {
        'row': {'type':'number'},
        'column': {'type':'number'}
      }
    }
  }
}

/*
  { parent_id: '363281a3-2b96-4f3f-9b8c-23fd2645a987',
  name: 'kos',
  is_directory: 'true' }
*/

const schema_create_object = {
  'type': 'object',
  'required': ['parent_id','name','is_directory'],
  'properties': {
    'parent_id': {'type':'string', 'format':'uuid'},
    'name': {
      'type':'string',
      'minLength': 1,
      'maxLength': 255,
      'pattern': valid_filename //regex for gyldige filnavn
    },
    'is_directory': { 'type': 'string' } //FML
  }
}

/*
{
{ object_id: 'c8408492-fb21-41ab-beb4-e9b68190a871',
  new_parent_id: 'e6bc1596-23dd-4fbd-8250-a55123784b96' }
}
*/

const schema_move_object = {
  'type': 'object',
  'required': ['object_id','new_parent_id'],
  'properties': {
    'object_id': {'type':'string', 'format':'uuid'},
    'new_parent_id': {'type':'string', 'format':'uuid'}
  }
}

/*
{ object_id: '1f8bb5d8-83ad-4ec6-bb7b-1654c72cc34c',
new_name: 'test.js' }
*/

const schema_rename_object = {
  'type': 'object',
  'required': ['object_id','new_name'],
  'properties': {
    'object_id': {'type':'string', 'format':'uuid'},
    'new_name': {
       'type':'string',
       'minLength': 1,
       'maxLength': 255,
       'pattern': valid_filename //regex for gyldige filnavn}
     }
   }
}

exports.create_project = ajv.compile(schema_create_project)

exports.event_subscribe = ajv.compile(schema_event_subscribe)
exports.event_update_connection_status = ajv.compile(schema_event_update_connection_status)
exports.chat = ajv.compile(schema_chat)

exports.editor_attach = ajv.compile(schema_editor_attach)
exports.editor_detach = ajv.compile(schema_editor_detach)
exports.editor_insert = ajv.compile(schema_editor_insert)
exports.editor_remove = ajv.compile(schema_editor_remove)

exports.create_object = ajv.compile(schema_create_object)
exports.move_object = ajv.compile(schema_move_object)
exports.rename_object = ajv.compile(schema_rename_object)
