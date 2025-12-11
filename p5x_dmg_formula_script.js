// python -m http.server

// 1. rotation simulation - 6T
// List of 5 characters - input inportant stats: Speed (for turn order), atk, atk mul, crit, crit mul, card set
// Pick a boss for defense stats
// Pick Wonder knife... (should be able to simulation with his knife at later version???)
// Other characters should have fixed rotation. The only one changing would just be Wonder and Navi and Chord???
//
// Loop would be Rotation X, one change skill A->B->C
// Rotation X1, 2nd change skill A->B->C

// 2nd: Card compare: which card and which set is better... probably pretty hard to do since support wants certain
// things. Maybe just dps stats?? Or just make it for Makoto Yuki, my beloved

// 3rd: give me a list of team members and their rev card set and their weapons / awareness, and I'll calculate and tell
// you what buffs/debuffs you should use on Wonder.
// May have to tie persona + overwrite persona level to the buffs/debuffs
// Wonder can only have 3 buffs, so I can list all the available buffs out, and do simple calculation based on that
// probably should also list dps stats in battle: attack, dmg mul, crit rate, crit mult, pierce rate
// maybe that is not as important...? buffs are based on user stats, so just wonder stats..., but the dmg will be based on
// the dps stats... may need to check more atk vs. more defense down...
// I think this is the calculation I need to be honest for the best dps

// 4th: Is awareness worth it? Which awareness is better for my BIS team?...

// 5th: Should I have a stat rec??? For example, if all their buffs not adding up to 100% crit, probably not worth doing crit mull??? Nah... impossible
// Still worth doing crit mult for stable domain...


const ENEMY_DEFENSE_DEFAULT = 363.2;  // doesn't have it - use Dominion value instead

const FINAL_DMG_BONUS = 1.40;  // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 
const OTHER_DMG_BONUS = 1; // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 

const CHAR_STAT_FILE_NAME = "P5X database - stat.csv";
const CARD_FILE_NAME = "P5X database - card.csv";
const SKILL_FILE_NAME = "P5X database - skill.csv";
const WEAPON_FILE_NAME = "P5X database - weapon.csv";
const WONDER_FILE_NAME = "P5X database - wonder.csv";
const FILE_NUM_SKIP_LINE = 2;   // skip the first 2 lines of the csv file

const NAV_BUFF_PERC = 0.20;     // Used for now. Once I do party member, I can remove this and get the correct value

// The base critical rate is 5%, and the base Critical DMG(Mult) is 150%, meaning there’s a 5% chance to deal 1.5x damage.
// If a character has any of this hidden stats in the database, it's a number already added to the base, so don't add the base again.
const BASE_CRIT_RATE = 5;   // 5%
const BASE_CRIT_MULT = 150; // 150%

// Skill level and mindscape level
const SKILL_LEVEL_10 = 0;
const SKILL_LEVEL_13 = 1;
const SKILL_LEVEL_10_MINDSCAPE_5 = 2;
const SKILL_LEVEL_13_MINDSCAPE_5 = 3;

// Code Role
const DPS_ROLE = 0;
const SUPPORT_ROLE = 1;
const NAVI_ROLE = 2;
const ALL_ROLE = 3;

// stores data read from the database
let charStatList = [];  
let cardList = [];  
let skillList = [];  
let weaponList = [];  
let wonderList = [];

// stores info regard the main character to sim/calc for
let iCharInfo = [];

// store a list of all the buff/debuff
let buffList = [];

readCharStatDatabase();
readCardDatabase();
readSkillDatabase();
readWeaponDatabase();
readWonderDatabase();

function runCalculation() {
    readCharStatDatabase();
    readCardDatabase();
    readSkillDatabase();
    readWeaponDatabase();
    readWonderDatabase();

    getHtmlInfo();

    buffList = [];

    // Using weapon, add to the buff list
    addWeaponToBuffList(iCharInfo.charName, iCharInfo.weapon, 0);

    // Add buffs from skill to buff list
    var skillIndex = addSelfSkillBuffToBuffList(iCharInfo.charName, iCharInfo.skill, iCharInfo.awareness, SKILL_LEVEL_10);

    console.log(buffList);

    for (var i = 0; i < charStatList.length; i++) {
        if (charStatList[i].charName == iCharInfo.charName) {
            iCharInfo.indexOfCharStatList = 0 + i;
            iCharInfo.hiddenAtk = charStatList[i].hiddenAtk;
            iCharInfo.hiddenCrit = charStatList[i].hiddenCrit;
            iCharInfo.hiddenCritMult = charStatList[i].hiddenCritMult;
        }
    }

    // I need to add hidden stats to these rate... Also should add weapon buffs too
    iCharInfo.atkFlat = iCharInfo.navAtk * NAV_BUFF_PERC + iCharInfo.atkFlat;
    iCharInfo.atkPerc = iCharInfo.hiddenAtk + iCharInfo.atkPerc;
    iCharInfo.dmgMult = iCharInfo.dmgMult;
    if (iCharInfo.hiddenCrit > 0) {
        iCharInfo.critRate = iCharInfo.hiddenCrit + iCharInfo.critRate;
    }
    else {
        iCharInfo.critRate = BASE_CRIT_RATE + iCharInfo.critRate;
    }

    if (iCharInfo.hiddenCritMult > 0) {
        iCharInfo.critMult = iCharInfo.hiddenCritMult + iCharInfo.critMult;
    }
    else {
        iCharInfo.critMult = BASE_CRIT_MULT + iCharInfo.critMult;
    }

    iCharInfo.pierceRate = iCharInfo.pierceRate;
    iCharInfo.baseAtk = 0 + getAtkValueFromAwareness(charStatList[iCharInfo.indexOfCharStatList]) + getWeapAtkValueFromAwareness(charStatList[iCharInfo.indexOfCharStatList]);

    iCharInfo.enemyDefense = ENEMY_DEFENSE_DEFAULT;
    iCharInfo.additionalDefCoef = ENEMY_DEFENSE_DEFAULT;
    iCharInfo.windswept = 0;    // yes = 0.12
    iCharInfo.defenseReduction = 0;

    // Add buffs and debuffs to everything
    let data = processDBuffList();
    iCharInfo.atkFlat += data.atkFlat;
    iCharInfo.atkPerc += data.atkPerc;
    iCharInfo.critMult += data.critMult;
    iCharInfo.critRate += data.critRate;
    iCharInfo.dmgMult += data.dmgMult;
    iCharInfo.pierceRate += data.pierceRate;
    iCharInfo.defenseReduction += data.defenseReduction;
    iCharInfo.windswept = data.windswept;


    // testing:
    iCharInfo.baseAtk = 1200 + 600;
    iCharInfo.atkFlat = 500;
    iCharInfo.atkPerc = 50;
    iCharInfo.dmgMult = 50 + 20 + 20;
    iCharInfo.enemyDefense = 400;
    iCharInfo.additionalDefCoef = 158.3;
    iCharInfo.pierceRate = 10;
    iCharInfo.defenseReduction = 80;
    iCharInfo.windswept = true;
    iCharInfo.critRate = 40;
    iCharInfo.critMult = 220;
    iCharInfo.weakness = "Weakness";

    iCharInfo.final_atk = calculateAtkFinal(iCharInfo.baseAtk, iCharInfo.atkFlat, iCharInfo.atkPerc);
    iCharInfo.final_dmgBonus = calculateDmgBonusFinal(iCharInfo.dmgMult);
    iCharInfo.critStableDomain = 1;
    iCharInfo.final_defenseReduction = calculateEnemyDefenseFinal(iCharInfo.enemyDefense, iCharInfo.additionalDefCoef, iCharInfo.windswept, iCharInfo.pierceRate, iCharInfo.defenseReduction);
    iCharInfo.final_skillPerc = calculateSkillPerc(skillList[skillIndex]);

    if (iCharInfo.includeCrit == "Yes") {
        iCharInfo.final_critStableDomain = calculateCritStableDomain(iCharInfo.critRate, iCharInfo.critMult);
    }

    let dmgPerHit = calculateSkillDamage(iCharInfo.final_atk, iCharInfo.final_dmgBonus, iCharInfo.final_defenseReduction, iCharInfo.final_critStableDomain, iCharInfo.final_skillPerc, convertEnemyWeaknessTextToValue(iCharInfo.weakness), FINAL_DMG_BONUS, OTHER_DMG_BONUS);

    // calculate the first dmg, // calculate 2nd dmg // output all those + total dmg

    console.log(dmgPerHit);
    console.log(iCharInfo);
}

function calculateSkillPerc(skill) {
    console.log(skill)
    return 1.2;
}

// using the buff list to add up all the the values
// check the condition to make sure it is ok before I can add
// how should I deal with condition?? I could go through the list to make sure I have the buff condition first
// before I add?? Like if he requires HL, I need to make sure I have that buff name on the list first 
// if the dps only buffs allies with some skills, I may need to filter it out when I add selfBuff/passive skills
function processDBuffList(skill) {
    let data = [];

    data.atkFlat = 0;
    data.atkPerc = 0;
    data.critMult = 0;
    data.critRate = 0;
    data.dmgMult = 0;
    data.pierceRate = 0;
    data.defenseReduction = 0;
    data.windswept = false;

    for (var i = 0; i < buffList.length; i++) {
        switch (buffList[i].dbuff) {
            case "SELF_ATK_PERC":   // fall through
            case "PARTY_ATK_PERC":
                data.atkPerc += buffList[i].value;
                break;
            case "SELF_ATK_FLAT":   // fall through
            case "PARTY_ATK_FLAT":   // fall through
            case "ALLY_ATK_FLAT":
                data.atkFlat += buffList[i].value;
                break;
            case "SELF_CRIT_MULT_PERC":   // fall through
            case "ALLIES_CRIT_MULT_PERC":   // fall through
            case "PARTY_CRIT_MULT_PERC":   // fall through
            case "ALLY_CRIT_MULT_PERC":  
                data.critMult += buffList[i].value;
                break;
            case "SELF_CRIT_PERC":   // fall through
            case "PARTY_CRIT_PERC":   // fall through
            case "ALLY_CRIT_PERC":
                data.critRate += buffList[i].value;
                break;
            case "SELF_DMG_PERC":   // fall through
            case "PARTY_DMG_PERC":   // fall through
            case "ALLY_DMG_PERC":
                data.dmgMult += buffList[i].value;
                break;
            case "SELF_PIERCE_PERC":   // fall through
            case "PARTY_PIERCE_PERC":   // fall through
            case "ALLY_PIERCE_PERC":
                data.pierceRate += buffList[i].value;
                break;
            case "DEF_DECR_PERC":   // fall through
            case "DEF_DECR_PERC_AOE":
                data.defenseReduction += buffList[i].value;
                break;
            case "WINDSWEEP_AOE":   // fall through
            case "WINDSWEEP":   // fall through
                data.windswept += true;
                break;
            default:
                break;
        }
    }

    return data;
}

// add the passive skill the character has to the HTML as soon as they choose a character
// If they don't like the passive buff, they can remove it
// I guess I can add buffs from skill into this... like [Moon Phase],
// and the user can remove it if they don't like it but it may be for another day
// After the buff list is done, I will grab straight from it instead...
function addPassiveSkillToHtmlBuffList() {

}

function addCardToBuffList() {

}

function addWonderBuffToBuffList() {
    // when I do this, make sure I don't add anything that is self
}

function addOthersSkillBuffToBuffList(charName, skill, awareness, skillLevel) {
    // Add other people buff to the list...
    // when I do this, make sure I don't add anything that is self

}

// Since I count by awarenss lowest to highest, the database better be in this order or it will break the code...
function addSelfSkillBuffToBuffList(charName, skill, awareness, skillLevel) {
    var item = -1;

    // Since I count by awarenss lowest to highest, the database better be in this order or it will break the code...
    for (var i = 0; i < skillList.length; i++) {
        if ((skillList[i].charName == charName) && (skill == skillList[i].skillPos)) {
            if (awareness == skillList[i].awareness) {
                // matching awareness, done
                item = i;
                break;
            }
            else if (awareness > skillList[i].awareness) {                
                break;
            }
            else {
                // if awareness is less, keep the highest found awareness, and continue to the next one.
                item = i;
            }            
        }
    }

    if (item < 0) {
        return item; // not found
    }

    let data = composeBuffData(skillList[item].e1dbuff, skillLevel, skillList[item].name, skillList[item].e1Lvl10,
        skillList[item].e1Lvl10m5, skillList[item].e1Lvl13, skillList[item].e1Lvl13m5, skillList[item].e1condition);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e2dbuff, skillLevel, skillList[item].name, skillList[item].e2Lvl10,
        skillList[item].e2Lvl10m5, skillList[item].e2Lvl13, skillList[item].e2Lvl13m5, skillList[item].e2condition);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e3dbuff, skillLevel, skillList[item].name, skillList[item].e3Lvl10,
        skillList[item].e3Lvl10m5, skillList[item].e3Lvl13, skillList[item].e3Lvl13m5, skillList[item].e3condition);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e4dbuff, skillLevel, skillList[item].name, skillList[item].e4Lvl10,
        skillList[item].e4Lvl10m5, skillList[item].e4Lvl13, skillList[item].e4Lvl13m5, skillList[item].e4condition);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e5dbuff, skillLevel, skillList[item].name, skillList[item].e5Lvl10,
        skillList[item].e5Lvl10m5, skillList[item].e5Lvl13, skillList[item].e5Lvl13m5, skillList[item].e5condition);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e6dbuff, skillLevel, skillList[item].name, skillList[item].e6Lvl10,
        skillList[item].e6Lvl10m5, skillList[item].e6Lvl13, skillList[item].e6Lvl13m5, skillList[item].e6condition);
    if (data.buffName) {
        buffList.push(data);
    }
    
    return item;   // save the index - probably needed for later to calculate skill damage

}

// Trash function, but at least it's less copy and paste making it less prone to bug
function composeBuffData(dbuff, skillLevel, name, lvl10, lvl10m5, lvl13, lvl13m5, condition) {
    let data = [];

    if ((dbuff != "") && !(dbuff == "DMG_SKILL_SINGLE") || (dbuff == "DMG_SKILL_AOE")) {
        data.buffName = name;
        switch (skillLevel) {
            case SKILL_LEVEL_10:
                data.value = lvl10;
                break;
            case SKILL_LEVEL_10_MINDSCAPE_5:
                data.value = lvl10m5;
                break;
            case SKILL_LEVEL_13:
                data.value = lvl13;
                break;
            case SKILL_LEVEL_13_MINDSCAPE_5:
                data.value = lvl13m5;
                break;
            default:
                data.value = 0;
                break;
        }

        data.dbuff = dbuff;
        data.condition = condition;        
    }

    return data;
}

// using the buff list, add value to it
function addWeaponToBuffList(charName, rarity, reforge) {
    for (var i = 0; i < weaponList.length; i++) {
        if ((weaponList[i].charName == charName) && (rarity == weaponList[i].rarity)) {
            // Such trash code... I really could do better than this...
            // should input these in an array when I read the database... seriously...
            if (weaponList[i].e1dbuff != "") {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.value = calcWeaponBasedOnReforge(weaponList[i].e1r0, 0, weaponList[i].e1r2, reforge);
                data.dbuff = weaponList[i].e1dbuff;
                data.condition = weaponList[i].e1condition;
                buffList.push(data);
            }

            if (weaponList[i].e2dbuff != "") {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.value = calcWeaponBasedOnReforge(weaponList[i].e2r0, weaponList[i].e1r1, 0, reforge);
                data.dbuff = weaponList[i].e2dbuff;
                data.condition = weaponList[i].e2condition;
                buffList.push(data);
            }

            if (weaponList[i].e3dbuff != "") {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.value = calcWeaponBasedOnReforge(weaponList[i].e3r0, weaponList[i].e3r1, 0, reforge);
                data.dbuff = weaponList[i].e3dbuff;
                data.condition = weaponList[i].e3condition;
                buffList.push(data);
            }

            if (weaponList[i].e3adbuff != "") {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.value = calcWeaponBasedOnReforge(weaponList[i].e3ar0, weaponList[i].e3ar1, 0, reforge);
                data.dbuff = weaponList[i].e3adbuff;
                data.condition = weaponList[i].e3acondition;
                buffList.push(data);
            }
//            console.log(buffList);
            return i;   // save the index
        }
    }    
}

// Code dealing with HTML 
function getHtmlInfo() {
    iCharInfo.charName = document.getElementById('charName').innerHTML;
    iCharInfo.skill = document.getElementById('skillChoice').innerHTML; // Will also filter out support skill so only DPS skill is listed
    iCharInfo.awareness = document.getElementById('awarenessChoice').innerHTML;
    iCharInfo.weapon = document.getElementById('weaponChoice').innerHTML;
    iCharInfo.cardSet = document.getElementById('cardChoice').innerHTML;
    iCharInfo.navAtk = parseFloat(document.getElementById('navAtk').value);

    iCharInfo.atkFlat = 0 + parseFloat(document.getElementById('spaceAtk').value);
    iCharInfo.atkPerc = 0 + parseFloat(document.getElementById('spaceAtkPercent').value);
    iCharInfo.dmgMult = 0 + parseFloat(document.getElementById('spaceDmgMult').value);
    iCharInfo.critRate = 0 + parseFloat(document.getElementById('spaceCritRate').value);
    iCharInfo.critMult = 0 + parseFloat(document.getElementById('spaceCritMult').value);
    iCharInfo.pierceRate = 0 + parseFloat(document.getElementById('spacePierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('sunAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('sunAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('sunDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('sunCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('sunCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('sunPierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('moonAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('moonAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('moonDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('moonCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('moonCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('moonPierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('starAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('starAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('starDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('starCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('starCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('starPierce').value);

    iCharInfo.atkFlat += parseFloat(document.getElementById('skyAtk').value);
    iCharInfo.atkPerc += parseFloat(document.getElementById('skyAtkPercent').value);
    iCharInfo.dmgMult += parseFloat(document.getElementById('skyDmgMult').value);
    iCharInfo.critRate += parseFloat(document.getElementById('skyCritRate').value);
    iCharInfo.critMult += parseFloat(document.getElementById('skyCritMult').value);
    iCharInfo.pierceRate += parseFloat(document.getElementById('skyPierce').value);

    iCharInfo.weakness = document.getElementById('enemyElemWeakness').innerHTML;
    iCharInfo.includeCrit = document.getElementById('critChoice').innerHTML;
    iCharInfo.bossName = document.getElementById('enemyChoice').innerHTML;

    var ulElement = document.getElementById('defDebuffOutputDiv');
    el = ulElement.firstElementChild;
    while (el) {
        processDefDebuff(el);
        el = el.nextElementSibling;
    }

    ulElement = document.getElementById('atkOutputDiv');
    el = ulElement.firstElementChild;
    while (el) {
        processAtkBuff(el);
        el = el.nextElementSibling;
    }

    // May need to go down to just DefReductionList/DmgMult and Atk/DmgMult list together since some buff does both...
    // Probably have a buff list and a debuff list... that makes the most sense I think...
    // I don't think anything does both buff and debuff...
    // I have to see how I enter info in the database.. I guess

    ulElement = document.getElementById('dmgOutputDiv');
    el = ulElement.firstElementChild;
    while (el) {
        processDmgBuff(el);
        el = el.nextElementSibling;
    }
}

function getAtkValueFromAwareness(charStat) {
    switch (iCharInfo.awareness) {
        case "A0":
            return charStat.a0Atk;
        case "A1":
            return charStat.a1Atk;
        case "A2":
            return charStat.a2Atk;
        case "A3":
            return charStat.a3Atk;
        case "A4":
            return charStat.a4Atk;
        case "A5":
            return charStat.a5Atk;
        case "A6":
            return charStat.a6Atk;
        default:
            console.log("awareness::Code does not match html value.")
            return charStat.a0Atk;
    }
}
function getWeapAtkValueFromAwareness(charStat) {
    switch (iCharInfo.weapon) {
        case "5*":
            return charStat.weap5Atk;
        case "4*":
            return charStat.weap4Atk;
        default:
            console.log("weapon::Code does not match html value.")
            return charStat.weap5Atk;
    }
}

function convertEnemyWeaknessTextToValue(text) {
    switch (text) {
        case "Normal":
            return 1;
        case "Resistance":
            return 0.5;
        case "Weakness":
            return 1.2;
        default:
            console.log("Code does not match html value.")
            return 1;
    }
}

function convertEnemyNameToDefenseValue(text) {
    switch (text) {
        case "Sea of Souls 8 LV89":
            return ENEMY_DEFENSE_DEFAULT; // Doesn't have it
        case "Dominion":
            return 363.2;
        case "Atavaka":
            return 1279.9;
        case "Vishnu":
            return 820.7;
        case "Mini Vishnu":
            return 363.2;
        case "Yatsufusa":
            return 1279.9;
        default:
            console.log("Code does not match html value.")
            return ENEMY_DEFENSE_DEFAULT;
    }
}

function convertEnemyNameToAdditionaDefenseValue(text) {
    switch (text) {
        case "Sea of Souls 8 LV89":
            return 1.632; // 163.2%
        case "Dominion": // fall through
        case "Atavaka":  // fall through
        case "Vishnu":   // fall through
        case "Mini Vishnu":
            return 1.584; // 158.4%
        case "Yatsufusa":
            return 2.059; // 205.9%
        default:
            console.log("Code does not match html value.")
            return 1.584;
    }
}

function fillCharacter(event) {
    let dropdown = document.getElementById("charListDiv");
    var firstChild = dropdown.children[0];  // Save the search Filter

    dropdown.textContent = '';
    dropdown.appendChild(firstChild);   //add back the search field

    readCharStatDatabase();

    // I'm not going to calculate trash DPS of your support/Wonder
    outputCharName(event, dropdown, charStatList, DPS_ROLE);

    const targetElement = dropdown;
    var x = targetElement.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");

    document.getElementById("userFilterCharlist").value = '';
}

function filterFunctionName() {
    filterFunction("userFilterCharlist", "charListDiv", "a");
}

function filterFunctionCard() {
    filterFunction("userFilterCardlist", "cardListDiv", "a");
}

function filterFunctionDef() {
    filterFunction("userFilterDefDebufflist", "defDebuffListDiv", "a");
}

function filterFunctionAtk() {
    filterFunction("userFilterAtklist", "atkListDiv", "a");
}

function filterFunctionDmg() {
    filterFunction("userFilterDmgList", "dmgListDiv", "a");
}

function outputCharName(event, dropdown, list, role) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].released == 'Y') {
            if (isValidRole(list[i].role, role)) {
                var item = document.createElement("a");
                item.setAttribute('class', 'w3-bar-item w3-button');
                item.innerHTML = list[i].charName;
                item.onclick = function () {
                    replaceHeaderWithName(this);
                };

                dropdown.appendChild(item);
            }
        }
    }
}

function isValidRole(role, roleName) {
    switch(roleName){
        case DPS_ROLE:
            if (role == "Assassin" || role == "Sweeper") {
                return true;
            }
            break;
        case SUPPORT_ROLE:
            if (role == "Strategist" || role == "Medic" || role == "Defense" || role == "Saboteur") {
                return true;
            }
            break;
        case NAVI_ROLE:
            if (role == "Elucidator") {
                return true;
            }
            break;
        case ALL_ROLE:
            return true;
            break;
        default:            
            break;
    }

    return false;
}

// --------------- End of HTML Interface -----------------------

// ------------------ Database related -------------------------
function readCharStatDatabase() {
    if (charStatList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + CHAR_STAT_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.charName = row[i][j++];
            data.released = row[i][j++];
            data.role = row[i][j++];
            data.a0Hp = parseFloat(row[i][j++]);
            data.a0Atk = parseFloat(row[i][j++]);
            data.a0Def = parseFloat(row[i][j++]);
            data.speed = parseFloat(row[i][j++]);
            data.a1Atk = parseFloat(row[i][j++]);
            data.a2Atk = parseFloat(row[i][j++]);
            data.a3Atk = parseFloat(row[i][j++]);
            data.a4Atk = parseFloat(row[i][j++]);
            data.a5Atk = parseFloat(row[i][j++]);
            data.a6Atk = parseFloat(row[i][j++]);
            data.hiddenAtk = parseFloat(row[i][j++]);
            data.hiddenDef = parseFloat(row[i][j++]);
            data.hiddenHp = parseFloat(row[i][j++]);
            data.hiddenCrit = parseFloat(row[i][j++]);
            data.hiddenSpeed = parseFloat(row[i][j++]);
            data.hiddenCritMult = parseFloat(row[i][j++]);
            data.hiddenHealing = parseFloat(row[i][j++]);
            data.hiddenAilment = parseFloat(row[i][j++]);
            data.hiddenSpRecovery = parseFloat(row[i][j++]);
            data.weap4Hp = parseFloat(row[i][j++]);
            data.weap4Atk = parseFloat(row[i][j++]);
            data.weap4Def = parseFloat(row[i][j++]);
            data.weap5Hp = parseFloat(row[i][j++]);
            data.weap5Atk = parseFloat(row[i][j++]);
            data.weap5Def = parseFloat(row[i][j++]);

            charStatList.push(data);
        }
    }

//    console.log(charStatList);
}
function readWeaponDatabase() {
    if (weaponList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + WEAPON_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.charName = row[i][j++];
            data.rarity = row[i][j++]; // This will be used to determine if it's a 4* or 5* weapon

            data.e1r0 = parseFloat(row[i][j++]);
            data.e1r2 = parseFloat(row[i][j++]);
            data.e1condition = row[i][j++];
            data.e1dbuff = row[i][j++];

            data.e2r0 = parseFloat(row[i][j++]);
            data.e2r1 = parseFloat(row[i][j++]);
            data.e2condition = row[i][j++];
            data.e2dbuff = row[i][j++];

            data.e3r0 = parseFloat(row[i][j++]);
            data.e3r1 = parseFloat(row[i][j++]);
            data.e3condition = row[i][j++];
            data.e3dbuff = row[i][j++];

            data.e3ar0 = parseFloat(row[i][j++]);
            data.e3ar1 = parseFloat(row[i][j++]);
            data.e3acondition = row[i][j++];
            data.e3adbuff = row[i][j++];

            weaponList.push(data);
        }
    }

//  console.log(weaponList);

}


function readCardDatabase() {
    if (cardList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + CARD_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.e1rate = parseFloat(row[i][j++]);
            data.e1dbcondition = row[i][j++];
            data.e1dbuff = row[i][j++];

            data.e2rate = parseFloat(row[i][j++]);
            data.e2dbcondition = row[i][j++];
            data.e2dbuff = row[i][j++];

            data.s2rate = parseFloat(row[i][j++]);
            data.s2dbcondition = row[i][j++];
            data.s2dbuff = row[i][j++];

            data.s4rate = parseFloat(row[i][j++]);
            data.s4dbcondition = row[i][j++];
            data.s4dbuff = row[i][j++];

            cardList.push(data);
        }
    }

//    console.log(cardList);
}

function readSkillDatabase() {
    if (skillList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + SKILL_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.charName = row[i][j++];
            data.skillPos = row[i][j++];
            data.awareness = row[i][j++];
            data.name = row[i][j++];
            data.type = row[i][j++];    // support or fire or passive

            data.e1Lvl10 = parseFloat(row[i][j++]);
            data.e1Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e1Lvl13 = parseFloat(row[i][j++]);
            data.e1Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e1numHit = parseFloat(row[i][j++]);
            data.e1dbuff = row[i][j++];
            data.e1condition = row[i][j++];

            data.e2Lvl10 = parseFloat(row[i][j++]);
            data.e2Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e2Lvl13 = parseFloat(row[i][j++]);
            data.e2Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e2numHit = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];

            data.e3Lvl10 = parseFloat(row[i][j++]);
            data.e3Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e3Lvl13 = parseFloat(row[i][j++]);
            data.e3Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e3numHit = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];

            data.e4Lvl10 = parseFloat(row[i][j++]);
            data.e4Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e4Lvl13 = parseFloat(row[i][j++]);
            data.e4Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e4numHit = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];

            data.e5Lvl10 = parseFloat(row[i][j++]);
            data.e5Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e5Lvl13 = parseFloat(row[i][j++]);
            data.e5Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e5numHit = parseFloat(row[i][j++]);
            data.e5dbuff = row[i][j++];
            data.e5condition = row[i][j++];

            data.e6Lvl10 = parseFloat(row[i][j++]);
            data.e6Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e6Lvl13 = parseFloat(row[i][j++]);
            data.e6Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e6numHit = parseFloat(row[i][j++]);
            data.e6dbuff = row[i][j++];
            data.e6condition = row[i][j++];

            skillList.push(data);
        }
    }

//    console.log(skillList);
}

function readWonderDatabase() {
    if (wonderList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + WONDER_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.type = row[i][j++];

            data.e1r0 = parseFloat(row[i][j++]);
            data.e1r1 = parseFloat(row[i][j++]);
            data.e1r2 = parseFloat(row[i][j++]);
            data.e1r3 = parseFloat(row[i][j++]);
            data.e1r4 = parseFloat(row[i][j++]);
            data.e1r5 = parseFloat(row[i][j++]);
            data.e1r6 = parseFloat(row[i][j++]);
            data.e1dbuff = row[i][j++];
            data.e1condition = row[i][j++];

            data.e2r0 = parseFloat(row[i][j++]);
            data.e2r1 = parseFloat(row[i][j++]);
            data.e2r2 = parseFloat(row[i][j++]);
            data.e2r3 = parseFloat(row[i][j++]);
            data.e2r4 = parseFloat(row[i][j++]);
            data.e2r5 = parseFloat(row[i][j++]);
            data.e2r6 = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];

            data.e3r0 = parseFloat(row[i][j++]);
            data.e3r1 = parseFloat(row[i][j++]);
            data.e3r2 = parseFloat(row[i][j++]);
            data.e3r3 = parseFloat(row[i][j++]);
            data.e3r4 = parseFloat(row[i][j++]);
            data.e3r5 = parseFloat(row[i][j++]);
            data.e3r6 = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];

            data.e4r0 = parseFloat(row[i][j++]);
            data.e4r1 = parseFloat(row[i][j++]);
            data.e4r2 = parseFloat(row[i][j++]);
            data.e4r3 = parseFloat(row[i][j++]);
            data.e4r4 = parseFloat(row[i][j++]);
            data.e4r5 = parseFloat(row[i][j++]);
            data.e4r6 = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];

            data.e5r0 = parseFloat(row[i][j++]);
            data.e5r1 = parseFloat(row[i][j++]);
            data.e5r2 = parseFloat(row[i][j++]);
            data.e5r3 = parseFloat(row[i][j++]);
            data.e5r4 = parseFloat(row[i][j++]);
            data.e5r5 = parseFloat(row[i][j++]);
            data.e5r6 = parseFloat(row[i][j++]);
            data.e5dbuff = row[i][j++];
            data.e5condition = row[i][j++];

            data.e6r0 = parseFloat(row[i][j++]);
            data.e6r1 = parseFloat(row[i][j++]);
            data.e6r2 = parseFloat(row[i][j++]);
            data.e6r3 = parseFloat(row[i][j++]);
            data.e6r4 = parseFloat(row[i][j++]);
            data.e6r5 = parseFloat(row[i][j++]);
            data.e6r6 = parseFloat(row[i][j++]);
            data.e6dbuff = row[i][j++];
            data.e6condition = row[i][j++];

            wonderList.push(data);
        }
    }

//    console.log(wonderList);
}

