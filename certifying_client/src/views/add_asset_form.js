

const m = require('mithril')

const api = require('../services/api')
const payloads = require('../services/payloads')
const transactions = require('../services/transactions')
const parsing = require('../services/parsing')
const forms = require('../components/forms')
const layout = require('../components/layout')

/**
 * Possible selection options
 */
const authorizableProperties = [
  ['status', 'Certification Status'],
  ['location', 'Location'],
  ['temperature', 'Temperature'],
  ['shock', 'Shock']
]

/**
 * The Form for tracking a new asset.
 */
const AddAssetForm = {
  oninit (vnode) {
    vnode.state.reporters = [
      {
        reporterKey: '',
        properties: []
      }
    ]
    api.get('agents')
      .then(agents => {
        const publicKey = api.getPublicKey()
        vnode.state.agents = agents.filter(agent => agent.key !== publicKey)
      })
  },

  view (vnode) {
    const setter = forms.stateSetter(vnode.state)
    return [
      m('.add_asset_form',
        m('form', {
          onsubmit: (e) => {
            e.preventDefault()
            _handleSubmit(vnode.attrs.signingKey, vnode.state)
          }
        },
        m('legend', 'Track New Asset'),
        forms.textInput(setter('serialNumber'), 'Serial Number'),

        layout.row([
          forms.textInput(setter('type'), 'Type'),
          forms.textInput(setter('subtype'), 'Subtype', false)
        ]),

        forms.group(' Certification Status', forms.field(setter('status'), {
          type: 'number',
          step: 'any',
          min: 0,
	  max: 1,
          required: false
        })),

        layout.row([
          forms.group('Latitude', forms.field(setter('latitude'), {
            type: 'number',
            step: 'any',
            min: -90,
            max: 90,
            required: false
          })),
          forms.group('Longitude', forms.field(setter('longitude'), {
            type: 'number',
            step: 'any',
            min: -180,
            max: 180,
            required: false
          }))
        ]),

        m('.reporters.form-group',
          m('label', 'Authorize Reporters'),
          vnode.state.reporters.map((reporter, i) =>
            m('.row.mb-2',
              m('.col-sm-8',
                m('input.form-control', {
                  type: 'text',
                  placeholder: 'Add reporter by name or public key...',
                  oninput: m.withAttr('value', (value) => {
                    vnode.state.reporters[i].reporterKey = null
                    const reporter = vnode.state.agents.find(agent => {
                      return agent.name === value || agent.key === value
                    })
                    if (reporter) {
                      vnode.state.reporters[i].reporterKey = reporter.key
                    }
                  }),
                  onblur: () => _updateReporters(vnode, i)
                })),

             m('.col-sm-4',
                m(forms.MultiSelect, {
                  label: 'Select Fields',
                  options: authorizableProperties,
                  selected: reporter.properties,
                  onchange: (selection) => {
                    vnode.state.reporters[i].properties = selection
                  }
                }))))),

        m('.row.justify-content-end.align-items-end',
          m('col-2',
            m('button.btn.btn-primary',
              'Create Record')))))
    ]
  }
}

/**
 * Update the reporter's values after a change occurs in the name of the
 * reporter at the given reporterIndex. If it is empty, and not the only
 * reporter in the list, remove it.  If it is not empty and the last item
 * in the list, add a new, empty reporter to the end of the list.
 */
const _updateReporters = (vnode, reporterIndex) => {
  let reporterInfo = vnode.state.reporters[reporterIndex]
  let lastIdx = vnode.state.reporters.length - 1
  if (!reporterInfo.reporterKey && reporterIndex !== lastIdx) {
    vnode.state.reporters.splice(reporterIndex, 1)
  } else if (reporterInfo.reporterKey && reporterIndex === lastIdx) {
    vnode.state.reporters.push({
      reporterKey: '',
      properties: []
    })
  }
}

/**
 * Handle the form submission.
 *
 * Extract the appropriate values to pass to the create record transaction.
 */
const _handleSubmit = (signingKey, state) => {
  const properties = [{
    name: 'type',
    stringValue: state.type,
    dataType: payloads.createRecord.enum.STRING
  }]

  if (state.subtype) {
    properties.push({
      name: 'subtype',
      stringValue: state.subtype,
      dataType: payloads.createRecord.enum.STRING
    })
  }

  if (state.weight) {
    properties.push({
      name: 'weight',
      intValue: parsing.toInt(state.weight),
      dataType: payloads.createRecord.enum.INT
    })
  }

  if (state.latitude && state.longitude) {
    properties.push({
      name: 'location',
      locationValue: {
        latitude: parsing.toInt(state.latitude),
        longitude: parsing.toInt(state.longitude)
      },
      dataType: payloads.createRecord.enum.LOCATION
    })
  }

  const recordPayload = payloads.createRecord({
    recordId: state.serialNumber,
    recordType: 'asset',
    properties
  })

  const reporterPayloads = state.reporters
    .filter((reporter) => !!reporter.reporterKey)
    .map((reporter) => payloads.createProposal({
      recordId: state.serialNumber,
      receivingAgent: reporter.reporterKey,
      role: payloads.createProposal.enum.REPORTER,
      properties: reporter.properties
    }))

  transactions.submit([recordPayload].concat(reporterPayloads), true)
    .then(() => m.route.set(`/assets/${state.serialNumber}`))
}

module.exports = AddAssetForm
