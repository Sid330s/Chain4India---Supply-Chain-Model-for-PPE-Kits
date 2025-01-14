
'use strict'

const m = require('mithril')
const _ = require('lodash')

const layout = require('./layout')

/**
 * Returns a labeled form group
 */
const group = (label, ...contents) => {
  return m('.form-group', [
    m('label', label),
    contents
  ])
}

/**
 * Returns a bare input field suitable for use in a form group.
 * Passes its value to a callback, and defaults to required.
 */
const field = (onValue, attrs = null) => {
  const defaults = {
    required: true,
    oninput: m.withAttr('value', onValue)
  }
  /*console.log('This is onValue' + onValue)
  console.log('This is defaults' + defaults)
  console.log('This is defaults' + attrs)
*/
  return m('input.form-control.mb-1', _.assign(defaults, attrs))
}

/**
 * Returns a labeled input field which passes its value to a callback
 */
const input = (type, onValue, label, required = true) => {
  return group(label, field(onValue, { type, required }))
}

const textInput = _.partial(input, 'text')
const passwordInput = _.partial(input, 'password')
const numberInput = _.partial(input, 'number')
const emailInput = _.partial(input, 'email')

/**
 * Creates an icon with an onclick function
 */
const clickIcon = (name, onclick) => {
  return m('span.mx-3', { onclick }, layout.icon(name))
}

/**
 * Convenience function for returning partial onValue functions
 */
const stateSetter = state => key => value => { state[key] = value }

/**
 * Event listener which will set HTML5 validation on the triggered element
 */
const validator = (predicate, message, id = null) => e => {
  const element = id === null ? e.target : document.getElementById(id)

  if (predicate(element.value)) {
    element.setCustomValidity('')
  } else {
    element.setCustomValidity(message)
  }
}

/**
 * Triggers a download of a dynamically created text file
 */
const triggerDownload = (name, ...contents) => {
  const file = new window.Blob(contents, {type: 'text/plain'})
  const href = window.URL.createObjectURL(file)
  const container = document.getElementById('download-container')
  m.render(container, m('a#downloader', { href, download: name }))
  document.getElementById('downloader').click()
  m.mount(container, null)
}

/**
 * A MultiSelect component.
 *
 * Given a set of options, and currently selected values, allows the user to
 * select all, deselect all, or select multiple.
 */
const MultiSelect = {
  view (vnode) {
    let handleChange = vnode.attrs.onchange || (() => null)
    let selected = vnode.attrs.selected
    let color = vnode.attrs.color || 'light'
    return [
      m('.dropdown',
        m(`button.btn.btn-${color}.btn-block.dropdown-toggle.text-left`,
          {
            'data-toggle': 'dropdown',
          }, vnode.attrs.label),
        m('.dropdown-menu.w-100',
          m("a.dropdown-item[href='#']", {
            onclick: (e) => {
              e.preventDefault()
              handleChange(vnode.attrs.options.map(([value, label]) => value))
            }
          }, 'Select All'),
          m("a.dropdown-item[href='#']", {
            onclick: (e) => {
              e.preventDefault()
              handleChange([])
            }
          }, 'Deselect All'),
          m('.dropdown-divider'),
          vnode.attrs.options.map(
            ([value, label]) =>
             m("a.dropdown-item[href='#']", {
               onclick: (e) => {
                 e.preventDefault()

                 let setLocation = selected.indexOf(value)
                 if (setLocation >= 0) {
                   selected.splice(setLocation, 1)
                 } else {
                   selected.push(value)
                 }

                 handleChange(selected)
               }
             }, label, (selected.indexOf(value) > -1 ? ' \u2714' : '')))))
    ]
  }
}
const field_status_dropdown = (onValue, attrs = null) => {
  return m('form',
  m("select",
[    
      m("option", {onclick: (e)=>{
         e.preventDefault()
         onValue(2)}}, 
        "Uncertified"),
     m("option", {onclick: (e)=>{
         e.preventDefault()
         onValue(1)}}, 
        "Certified")
]

      ))
}


/*
const field_status_dropdown = (onValue, attrs = null) => {
  const defaults = {
    required: true,
    onclick: m.withAttr('value', onValue)
  }


  return m("form",
  m("select",       
      m("option", onclick: (defaults, 
        "Certified"
      )
    )
  )


}
*/
module.exports = {
  group,
  field,
  input,
  textInput,
  passwordInput,
  numberInput,
  emailInput,
  clickIcon,
  stateSetter,
  validator,
  triggerDownload,
  MultiSelect,
  field_status_dropdown
}
