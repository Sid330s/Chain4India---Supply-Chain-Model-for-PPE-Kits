
'use strict'

const _ = require('lodash')
const protobuf = require('protobufjs')
const protoJson = require('../protos.json')

const ACTIONS = [
  'CREATE_AGENT',
  'CREATE_RECORD',
  'FINALIZE_RECORD',
  'CREATE_RECORD_TYPE',
  'UPDATE_PROPERTIES',
  'CREATE_PROPOSAL',
  'ANSWER_PROPOSAL',
  'REVOKE_REPORTER'
]

const titleify = allCaps => {
  return allCaps
    .split('_')
    .map(word => word[0] + word.slice(1).toLowerCase())
    .join('')
}

const actionMap = ACTIONS.reduce((map, enumName) => {
  const key = enumName[0].toLowerCase() + titleify(enumName).slice(1)
  const className = titleify(enumName) + 'Action'
  return _.set(map, key, { enum: enumName, name: className })
}, {})

const root = protobuf.Root.fromJSON(protoJson)
const SCPayload = root.lookup('SCPayload')
const PropertyValue = root.lookup('PropertyValue')
const PropertySchema = root.lookup('PropertySchema')
const Location = root.lookup('Location')
const Proposal = root.lookup('Proposal')
_.map(actionMap, action => {
  return _.set(action, 'proto', root.lookup(action.name))
})

const propertiesXformer = xform => data => {
  return _.set(data, 'properties', data.properties.map(xform))
}
const valueXform = propertiesXformer(prop => PropertyValue.create(prop))
const schemaXform = propertiesXformer(prop => {
  if (prop.locationValue) {
    prop.locationValue = Location.create(prop.locationValue)
  }
  return PropertySchema.create(prop)
})

_.map(actionMap, action => _.set(action, 'xform', x => x))
actionMap.createRecord.xform = valueXform
actionMap.createRecordType.xform = schemaXform
actionMap.updateProperties.xform = valueXform

/**
 * Encodes a new SCPayload with the specified action
 */
const encode = (actionKey, actionData) => {
  const action = actionMap[actionKey]
  if (!action) {
    throw new Error('There is no payload action with that key')
  }

  return SCPayload.encode({
    action: SCPayload.Action[action.enum],
    timestamp: Math.floor(Date.now() / 1000),
    [actionKey]: action.proto.create(action.xform(actionData))
  }).finish()
}

/**
 * Particular encode methods can be called directly with their key name
 * For example: payloads.createAgent({name: 'Susan'})
 */
const actionMethods = _.reduce(actionMap, (methods, value, key) => {
  return _.set(methods, key, _.partial(encode, key))
}, {})

actionMethods.createRecord.enum = PropertySchema.DataType
actionMethods.createRecordType.enum = PropertySchema.DataType
actionMethods.updateProperties.enum = PropertySchema.DataType
actionMethods.createProposal.enum = Proposal.Role
actionMethods.answerProposal.enum = actionMap.answerProposal.proto.Response

module.exports = _.assign({
  encode,
  FLOAT_PRECISION: 1000000
}, actionMethods)
