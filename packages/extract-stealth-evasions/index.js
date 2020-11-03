#!/usr/bin/env node

const puppeteer = require('puppeteer-extra')
const stealth = require('puppeteer-extra-plugin-stealth')()
const { minify } = require('terser')
const argv = require('yargs')
  .usage('Usage: $0 [options]')
  .alias('e', 'exclude')
  .describe('e', 'Exclude evasion (repeat for multiple)')
  .alias('i', 'include')
  .describe('i', 'Include evasion (repeat for multiple)')
  .alias('l', 'list')
  .describe('l', 'List available evasions')
  .alias('m', 'minify')
  .describe('minify', 'Minify the output')
  .boolean('m')
  .default('m', true)
  .help('h')
  .alias('h', 'help').argv
const fs = require('fs')

const file = 'stealth' + (argv.minify === true ? '.min' : '') + '.js'

if (argv.exclude) {
  if (typeof argv.exclude === 'string') {
    stealth.enabledEvasions.delete(argv.exclude)
  } else {
    argv.exclude.forEach(e => {
      stealth.enabledEvasions.delete(e)
    })
  }
} else if (argv.include) {
  if (typeof argv.include === 'string') {
    stealth.enabledEvasions = [argv.include]
  } else {
    stealth.enabledEvasions = []
    argv.include.forEach(e => {
      stealth.enabledEvasions.push(e)
    })
  }
} else if (argv.list) {
  console.log('Available evasions:', [...stealth.availableEvasions].join(', '))
  process.exit(0)
}

let scripts = ''

puppeteer
  .use(stealth)
  .launch({
    headless: true
  })
  .then(async browser => {
    // Patch evaluateOnNewDocument()
    const page = (await browser.pages()).find(Boolean)
    page.__proto__.evaluateOnNewDocument = patchEval // eslint-disable-line no-proto
    page.__proto__.evaluate = patchEval // eslint-disable-line no-proto

    await (await browser.newPage()).goto('about:blank')
    await browser.close()

    fs.writeFile(
      file,
      `/*!
 * Note: Auto-generated, do not update manually.
 * Generated by: https://github.com/berstend/puppeteer-extra/tree/master/packages/extract-stealth-evasions
 * Generated on: ${new Date().toUTCString()}
 * License: MIT
 */
` +
        (argv.minify === true
          ? (await minify(scripts, { toplevel: true })).code
          : scripts),
      err => {
        if (err) throw err
        console.log(`File ${file} written!`)
        console.log(
          'Included evasions: ',
          [...stealth.enabledEvasions].join(', ')
        )
      }
    )
  })

function patchEval(f, args) {
  if (argv.minify !== true) {
    let reg = (new Error()).stack.match(/\/evasions\/(?!_utils)([^\/]+)\//);
    if (reg)
      scripts += '\n\n/**\nEVASION '+reg[1]+'\n**/\n';
    else
      scripts += '\n\n/**\nEVASION\n**/\n';
  }
  // Check if there are options supplied
  if (typeof args !== 'undefined') {
    scripts += '(' + f.toString() + ')(' + JSON.stringify(args) + ');\n'
  } else {
    scripts += '(' + f.toString() + ')();\n'
  }
}
