const util = require('util');
const jsonQuery = require('json-query');
const titlecase = require('titlecase');
const pad = require('pad');

const fs = require('fs');
const path = require('path');

const enlirJsonPath = path.join(__dirname, '..', 'enlir_json');
const enlirAbilitiesPath = path.join(enlirJsonPath, 'abilities.json');
const enlirSoulbreaksPath = path.join(enlirJsonPath, 'soulbreaks.json');
const enlirBsbCommandsPath = path.join(enlirJsonPath, 'bsbCommands.json');

const enlirAbilitiesFile = fs.readFileSync(enlirAbilitiesPath);
const enlirSoulbreaksFile = fs.readFileSync(enlirSoulbreaksPath);
const enlirBsbCommandsFile = fs.readFileSync(enlirBsbCommandsPath);

const enlirAbilities = JSON.parse(enlirAbilitiesFile);
const enlirSoulbreaks = JSON.parse(enlirSoulbreaksFile);
const enlirBsbCommands = JSON.parse(enlirBsbCommandsFile);

/** exports.ability:
 * Retrieves information about an ability.
 * @param {Object} msg: A message object from the Discord.js bot.
 * @param {Array} args: An array of arguments. This should only be
 * one value, and should contain only the following:
 *  * @param {String} abilityName: The desired ability name to look
 *    up. If the ability name has a space, the ability name should be
 *    encased in 'quotes'.
 **/
exports.ability = function lookupAbility(msg, args) {
  if (args.length < 3) {
    msg.reply('Search query must be at least three characters.');
    return;
  };
  let query;
  query = titlecase.toLaxTitleCase(args);
  console.log(`Ability to lookup: ${query}`);
  console.log(util.format('.ability caller: %s#%s',
    msg.author.username, msg.author.discriminator));
  let queryString = util.format('[name~/%s/i]', query);
  console.log(`queryString: ${queryString}`);
  let result = jsonQuery(queryString, {
    data: enlirAbilities,
    allowRegexp: true,
  });
  if (result.value === null) {
    msg.channel.send(`Ability '${query}' not found.`);
  } else {
    processAbility(result, msg);
  };
};

/** searchSoulbreak:
 * Searches and returns the soul breaks for a given character.
 * @param {String} character: the name of the character to search.
 * @param {String} sbType: The type of soul break to look up
 *  (one of: all, default, sb, bsb, usb, osb). Defaults to 'all'.)
 * @return {Array} soulbreaks: An array of soulbreaks by name
 **/
function searchSoulbreak(character, sbType='all') {
  console.log(`Character to lookup: ${character}`);
  console.log(`Soul break to return: ${sbType}`);
  let characterQueryString = util.format('[*character~/^%s$/i]', character);
  console.log(`characterQueryString: ${characterQueryString}`);
  let result;
  result = jsonQuery(characterQueryString, {
    data: enlirSoulbreaks,
    allowRegexp: true,
  });
  console.log(result);
  if (result.value === null) {
    console.log('No results found.');
    return result;
  };
  if (sbType.toLowerCase() !== 'all') {
    let dataset = result.value;
    let tierQueryString = util.format('[*tier~/^%s$/i]', sbType);
    console.log(`tierQueryString: ${tierQueryString}`);
    result = jsonQuery(tierQueryString, {
      data: dataset,
      allowRegexp: true,
    });
  };
  console.log('Returning results.');
  return result;
};

/** lookupSoulbreak:
 *  Runs searchSoulbreak to find a soul break for a given character.
 *  @param {Object} msg: A message object from the Discord.js bot.
 *  @param {String} character: the name of the character to search.
 *  @param {String} sbType: the type of soul break to search.
 *    (one of: all, default, sb, bsb, usb, osb). Defaults to 'all'.)
 **/
exports.soulbreak = function lookupSoulbreak(msg, character, sbType) {
  console.log(util.format(',sb caller: %s#%s',
    msg.author.username, msg.author.discriminator));
  console.log(`Lookup called: ${character} ${sbType}`);
  if (character.length < 3) {
    msg.channel.send(
      'Character name must be at least three characters.');
    return;
  };
  let possibleSbTypes = ['all', 'default', 'sb', 'bsb', 'usb', 'osb'];
  if (possibleSbTypes.indexOf(sbType.toLowerCase()) === -1) {
    msg.channel.send(
      'Soulbreak type not one of: All, Default, SB, BSB, USB, OSB.');
    return;
  };
  let results = new Promise((resolve, reject) => {
    resolve(searchSoulbreak(character, sbType));
  });
  results.then( (resolve) => {
    console.log(resolve.value);
    if (resolve.value.length === 0) {
      msg.channel.send(`No results for '${character}'.`);
      return;
    };
    if (resolve.value.length > 4) {
      character = titlecase.toLaxTitleCase(character);
      msg.channel.send(`${character} has ${resolve.value.length} soulbreaks.` +
        ` Please filter by Default/SB/BSB/USB/OSB.`);
      return;
    };
    resolve.value.forEach( (value) => {
      // Holy heck I'll need to make this into its own function somehow.
      let element;
      if (value.element === undefined ||
          value.element === '-') {
        element = 'None';
      } else {
        element = value.element;
      };
      let padLength = 22;
      let typeMsg = pad(
        util.format('Type: %s', value.type),
        padLength);
      let elementMsg = util.format('Element: %s', element);
      let targetMsg = pad(
        util.format('Target: %s', value.target),
        padLength);
      let multiplierMsg = util.format('Multiplier: %s', value.multiplier);
      let castMsg = pad(
        util.format('Cast Time: %ds', value.time),
        padLength);
      let sbMsg = util.format('Soul Break Type: %s', value.tier);
      let message = (
        '**```\n' +
        util.format('%s\n', value.name) +
        util.format('%s\n', sbMsg) +
        util.format('%s || %s\n', typeMsg, elementMsg) +
        util.format('%s || %s\n', targetMsg, multiplierMsg) +
        util.format('%s\n', castMsg) +
        '```**'
        );
      msg.channel.send(message);
    });
  }).catch( (reject) => {
    console.log(`Something unexpected happened. Error: ${reject}`);
  });
  return;
};

/** processAbility:
 * Processes and outputs information about an ability.
 * @param {Object} result: A JSON list of a given ability.
 * @param {Object} msg: a discord.js message object.
 **/
function processAbility(result, msg) {
  let description;
  if (result.value.effects === undefined) {
    description = util.format('%s Attack', result.value.formula);
  } else {
    description = result.value.effects;
  };
  let multiplier;
  if (result.value.multiplier === undefined) {
    multiplier = 0;
  } else {
    multiplier = result.value.multiplier;
  };
  let element;
  if (result.value.element === undefined ||
      result.value.element === '-') {
    element = 'None';
  } else {
    element = result.value.element;
  };
  let padLength = 20;
  let typeMsg = pad(
    util.format('Type: %s', result.value.school),
    padLength);
  let elementMsg = util.format('Element: %s', element);
  let targetMsg = pad(
    util.format('Target: %s', result.value.target),
    padLength);
  let multiplierMsg = util.format('Multiplier: %s', multiplier);
  let castMsg = pad(
    util.format('Cast Time: %ds', result.value.time),
    padLength);
  let sbMsg = util.format('Soul Break Charge: %d', result.value.sb);
  let message = (
    '**```\n' +
    util.format('%s\n', result.value.name) +
    util.format('%s\n', description) +
    util.format('%s || %s\n', typeMsg, elementMsg) +
    util.format('%s || %s\n', targetMsg, multiplierMsg) +
    util.format('%s || %s\n', castMsg, sbMsg) +
    '```**'
    );
  msg.channel.send(message);
};
