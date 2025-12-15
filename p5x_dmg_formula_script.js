/*
 * File: p5x_calculator
 * Description: 
 *  
 * 
 * Author: schau1 / cantiga
 * 
 * Copyright (c) 2025
 * 
*/

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
const ENEMY_DEFENSE_ADDITIONAL_DEFAULT = 158.4; // doesn't have it - use NTMR value instead

const FINAL_DMG_BONUS = 1.40;  // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 
const OTHER_DMG_BONUS = 1; // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 

const CHAR_STAT_FILE_NAME = "P5X database - stat.csv";
const CARD_FILE_NAME = "P5X database - card.csv";
const SKILL_FILE_NAME = "P5X database - skill.csv";
const WEAPON_FILE_NAME = "P5X database - weapon.csv";
const WONDER_FILE_NAME = "P5X database - wonder.csv";
const BOSS_FILE_NAME = "P5X database - boss.csv";
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

// Skill Behavior
const SKILL_BEHAVIOR_NORMAL = 0;
const SKILL_BEHAVIOR_DOT = 1;
const SKILL_BEHAVIOR_FOLLOW = 2;

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
let bossList = [];
let wonderKnifeList = [];

// Store data that will be used to output as an entry to the html file
let htmlWonderDbList = [];

// stores info regard the main character to sim/calc for
let iCharInfo = [];

// party members
let partyMembers = [];

// store a list of all the buff/debuff that will be processed by the app as part of the calculation
let buffList = [];

// store a list of all the buff/debuff that the user enters
let htmlDBuffList = [];

readCardDatabase();
readSkillDatabase();
readWeaponDatabase();
readWonderDatabase();
readBossDatabase();

function runCalculation() {
    readCharStatDatabase();
    readCardDatabase();
    readSkillDatabase();
    readWeaponDatabase();
    readWonderDatabase();
    readBossDatabase();

    initializeData();

    getHtmlInfo();

    for (var i = 0; i < charStatList.length; i++) {
        if (charStatList[i].charName == iCharInfo.charName) {
            iCharInfo.indexOfCharStatList = 0 + i;
            iCharInfo.hiddenAtk = charStatList[i].hiddenAtk;
            iCharInfo.hiddenCrit = charStatList[i].hiddenCrit;
            iCharInfo.hiddenCritMult = charStatList[i].hiddenCritMult;
            iCharInfo.role = charStatList[i].role;
            iCharInfo.isSees = ((charStatList[i].isSees == 'Y') || (charStatList[i].isSees == 'y')) ? true : false;
        }
    }

    // Add passive skill the the buff list. These are the ones that do not have a condition. If they have a condition to fullfill
    // add to the user Select buff list instead so that the user can pick them as they know if the condition works
    // No - Add all passive skills to the buff List. When I process the list, I go through it to see if there is any buff there
    // matching the required buffs instead. For example, I will go through the list and see this skill requires SEES, then, I will
    // check to see if SEES is found in that list. If not found, I will skip it. Right now I do that for the dmg portion
    // but I can do a 2nd pass of the list to remove anything that doesn't fit.
    addSelfPassiveSkillToBuffList(iCharInfo);

    // Using DPS weapon, add to the buff list
    addWeaponBuffToBuffList(iCharInfo.charName, iCharInfo.weapon, iCharInfo.reforgeLevel, DPS_ROLE);

    // Add buffs/debuffs from card set bonus
    addCardToBuffList(iCharInfo.cardSet, iCharInfo.charName, DPS_ROLE);

    // Add Wonder weapon
//    addWeaponBuffToBuffList(iCharInfo.charName, iCharInfo.weapon, iCharInfo.reforgeLevel, DPS_ROLE);

    // Add Weapons from Party Members - Not Wonder... I'll think about Wonder later...
    for (const party of partyMembers) {
        // SUPPORT_ROLE and NAVI_ROLE are the same here
        addWeaponBuffToBuffList(party.charName, party.weapon, party.reforgeLevel, SUPPORT_ROLE);
        addCardToBuffList(party.card, party.charName, SUPPORT_ROLE);
    }



    // Get skills and add buffs from the user selected skill (S1/S3) to buff list
    var skillIndex = addSkillBuffToBuffList(iCharInfo.charName, iCharInfo.awareness, iCharInfo.skillLevel, iCharInfo.skillName);
    if (skillIndex >= 0) {
        iCharInfo.skillType = skillList[skillIndex].skillType;
    }
    else {
        var element = document.getElementById("result");

        element.innerHTML = "";

        var item = document.createElement("p");
        item.innerHTML = "Error:: Info Not Found";
        element.appendChild(item);

        console.log("runCalculation::skill not found");

        return;
    }

    // Add buffs/debuffs from the user selected buff/debuff list
    addUserSelectedBuffToBuffList();    

    console.table(buffList);

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
    iCharInfo.enemyDefense = convertEnemyNameToDefenseValue(iCharInfo.bossName);
    iCharInfo.additionalDefCoef = convertEnemyNameToAdditionaDefenseValue(iCharInfo.bossName);

    // Add buffs and debuffs to everything
    let data = processDBuffList(iCharInfo.skillPos, iCharInfo.skillType);
    iCharInfo.atkFlat += data.atkFlat;
    iCharInfo.atkPerc += data.atkPerc;
    iCharInfo.critMult += data.critMult;
    iCharInfo.critRate += data.critRate;
    iCharInfo.dmgMult += data.dmgMult;
    iCharInfo.pierceRate += data.pierceRate;
    iCharInfo.defenseReduction += data.defenseReduction;
    iCharInfo.windswept = data.windswept;

    // testing:
/*    iCharInfo.baseAtk = 1200 + 600;
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
    iCharInfo.final_skillPerc[0].value = 1.2;
    */

    iCharInfo.final_atk = calculateAtkFinal(iCharInfo.baseAtk, iCharInfo.atkFlat, iCharInfo.atkPerc);
    iCharInfo.final_dmgBonus = calculateDmgBonusFinal(iCharInfo.dmgMult);
    iCharInfo.critStableDomain = 1;
    iCharInfo.final_defenseReduction = calculateEnemyDefenseFinal(iCharInfo.enemyDefense, iCharInfo.additionalDefCoef, iCharInfo.windswept, iCharInfo.pierceRate, iCharInfo.defenseReduction);
    iCharInfo.final_skillPerc = calculateSkillPerc(skillList[skillIndex], SKILL_LEVEL_10);
    iCharInfo.final_weakness = convertEnemyWeaknessTextToValue(iCharInfo.weakness);

    if (iCharInfo.includeCrit == "Yes") {
        iCharInfo.final_critStableDomain = calculateCritStableDomain(iCharInfo.critRate, iCharInfo.critMult);
    }

    let dmgPerHit = calculateSkillDamage(iCharInfo.final_atk, iCharInfo.final_dmgBonus, iCharInfo.final_defenseReduction, iCharInfo.final_critStableDomain, iCharInfo.final_skillPerc[0].value, iCharInfo.final_weakness, iCharInfo.finalBonus, OTHER_DMG_BONUS);
    let dmgPerHit2 = [0,0,0];

    if (iCharInfo.final_skillPerc[1].numHit > 0) {
        dmgPerHit2 = calculateSkillDamage(iCharInfo.final_atk, iCharInfo.final_dmgBonus, iCharInfo.final_defenseReduction, iCharInfo.final_critStableDomain, iCharInfo.final_skillPerc[1].value, iCharInfo.final_weakness, iCharInfo.finalBonus, OTHER_DMG_BONUS);        
    }
    // calculate the first dmg, // calculate 2nd dmg // output all those + total dmg

    displayResult(dmgPerHit, dmgPerHit2);
    
    console.log(iCharInfo);
}

function addNaviStats(percent) {
    atkFlat = parseFloat(document.getElementById('naviAtk').value) * percent / 100;
    dmgMult = parseFloat(document.getElementById('naviDmgMult').value) * percent / 100;
    critRate = parseFloat(document.getElementById('naviCritRate').value) * percent / 100;
    critMult = parseFloat(document.getElementById('naviCritMult').value) * percent / 100;
    pierceRate = parseFloat(document.getElementById('naviPierce').value) * percent / 100;

    return [atkFlat, dmgMult, critRate, critMult, pierceRate];
}

function initializeData() {
    buffList = [];
    htmlDBuffList = [];
    partyMembers = [];

    iCharInfo.baseAtk = 0;
    iCharInfo.atkFlat = 0;
    iCharInfo.atkPerc = 0;
    iCharInfo.dmgMult = 0;
    iCharInfo.enemyDefense = 0;
    iCharInfo.additionalDefCoef = 0;
    iCharInfo.pierceRate = 0;
    iCharInfo.defenseReduction = 0;
    iCharInfo.windswept = false;
    iCharInfo.critRate = 0;
    iCharInfo.critMult = 0;
    iCharInfo.weakness = "";
    iCharInfo.bossName = "";
    iCharInfo.charName = "Makoto Yuki";
    iCharInfo.skillPos = "";   // Skill position
    iCharInfo.skillName = "";
    iCharInfo.awareness = "";
    iCharInfo.weapon = "";
    iCharInfo.cardSet = "";
    iCharInfo.navAtk = 0;
    iCharInfo.navDmgMult = 0;
    iCharInfo.navCritMult = 0;
    iCharInfo.navCritRate = 0;
    iCharInfo.navPierceRate = 0;
    iCharInfo.includeCrit = "";
    iCharInfo.skillType = "";   // Support, Passive, Fire/Nuclear/etc...
    iCharInfo.role = "";
    iCharInfo.skillBehavior = 0; // Skill_Type: DoT, Follow Up (Resonane), Normal
    iCharInfo.final_weakness = 0;
    iCharInfo.skillLevel = 0;
    iCharInfo.reforgeLevel = 0;
    iCharInfo.final_critStableDomain = 1;
    iCharInfo.isSees = false;
    iCharInfo.finalBonus = 0;
}
// Return a list of skill percentage for the skill and its follow up
// @param   skillLevel - the level of the skill: Level 10 skill or Level 13 skill etc
// @param   skill - item containing the skill from the database
// @todo: Assuming the skill has only 2 parts at most. If it's more than 2, need to adjust this code
function calculateSkillPerc(skill, skillLevel) {   
    let skillPercList = [];
    // The first one should be a skill percent. If it's not, screw you.
    if ((skill.e1dbuff == "DMG_SKILL_SINGLE") || (skill.e1dbuff == "DMG_SKILL_AOE")) {
        let data = [];
        switch (skillLevel) {
            case SKILL_LEVEL_10:
                data.value = skill.e1Lvl10;
                break;
            case SKILL_LEVEL_10_MINDSCAPE_5:
                data.value = skill.e1Lvl10m5;
                break;
            case SKILL_LEVEL_13:
                data.value = skill.e1Lvl13;
                break;
            case SKILL_LEVEL_13_MINDSCAPE_5:
                data.value = skill.e1Lvl13m5;
                break;
            default:
                data.value = 0;
                break;
        }
        data.value = data.value / 100;
        data.numHit = skill.e1numHit;

        skillPercList.push(data);
    }
    else {
        let data = [];
        data.value = 0;
        data.numHit = 0;
        skillPercList.push(data);
        skillPercList.push(data);
    }

    if ((skill.e2dbuff == "DMG_SKILL_SINGLE") || (skill.e2dbuff == "DMG_SKILL_AOE")) {
        let data = [];
        data.value = 0;
        data.numHit = 0;

        // if the condition is not fulfilled, this skill dmg doesn't exist, just quit
        if (!IsValidSkillCondition(skill.e2condition)) {
            skillPercList.push(data);
        }
        else {
            switch (skillLevel) {
                case SKILL_LEVEL_10:
                    data.value = skill.e2Lvl10;
                    break;
                case SKILL_LEVEL_10_MINDSCAPE_5:
                    data.value = skill.e2Lvl10m5;
                    break;
                case SKILL_LEVEL_13:
                    data.value = skill.e2Lvl13;
                    break;
                case SKILL_LEVEL_13_MINDSCAPE_5:
                    data.value = skill.e2Lvl13m5;
                    break;
                default:
                    data.value = 0;
                    break;
            }
            data.value = data.value / 100;
            data.numHit = skill.e2numHit;

            skillPercList.push(data);
        }
    }
    else {
        let data = [];
        data.value = 0;
        data.numHit = 0;
        skillPercList.push(data);
    }

    return skillPercList;
}

function IsValidSkillCondition(condition) {
    if (condition != "") {
        // this has a requirement, need to go through the buff to see if the user has the buff
        for (var i = 0; i < buffList.length; i++) {
            if (buffList[i].buffName.includes(condition)){
                return true;
            }
        }
    }
    else {
        // it does not have a requirement, so it's fine.
        return true;
    }

    return false;
}

// using the buff list to add up all the the values
// check the condition to make sure it is ok before I can add
// how should I deal with condition?? I could go through the list to make sure I have the buff condition first
// before I add?? Like if he requires HL, I need to make sure I have that buff name on the list first 
// if the dps only buffs allies with some skills, I may need to filter it out when I add selfBuff/passive skills
function processDBuffList(skill, element) {
    let data = [];
    data.atkFlat = 0;
    data.atkPerc = 0;
    data.critMult = 0;
    data.critRate = 0;
    data.dmgMult = 0;
    data.pierceRate = 0;
    data.defenseReduction = 0;
    data.windswept = false;
    let buffConditionMet = true;
    let failBuff = [];  // Just info for now

    for (var i = 0; i < buffList.length; i++) {
        buffConditionMet = true;

        // Go through the list to make sure I have the buff required before we add it.
        if (buffList[i].conditionType != "") {
            const searchName = buffList[i].condition.split(/[|&]/);
            const conditionName = buffList[i].conditionType.split(/[|&]/);
            let buffMet = [];

            // Handle each of the condition
            for (var j = 0; j < searchName.length; j++) {
                // if it's a debuff/buff, search the buffList to see if we can find it
                if (conditionName[j].includes("DBuff")) {
                    const buffItem = buffList.find(item => item.buffName.includes(searchName[j]));
                    if (!buffItem) {
                        buffMet[j] = false;
                    }
                    else {
                        buffMet[j] = true;
                    }
                }
                else if (conditionName[j].includes("Self Skill")) {
                    // self skill means it only applies to this skill, so check to see if the skill matches
                    if (skill == searchName[j]) {
                        buffMet[j] = true;
                    }
                    else {
                        buffMet[j] = false;
                    }
                }
                else if (conditionName[j].includes("Element")) {
                    if (element == searchName[j]) {
                        buffMet[j] = true;
                    }
                    else {
                        buffMet[j] = false;
                    }
                }
                else {
                    // not handled... Maybe I need to do something else in the future
                    // because right now, if I set this to true, it will basically ignore 
                    // any condition there.... like follow up skill would be assumed to be true
                    buffMet[j] = true;
                }
            }

            if (buffList[i].condition.includes("|")) {
                // Check the condition to see if they match
                // @todo: How do I know if it's and & or |???? because now I'm assuming only either | or &, not a 
                // mix of such as ((SEES & Theugry) | S3)... Will need more complicated algo to handle it...
                buffConditionMet = false;
/*                if (buffList[i].conditionType.includes("element")){
                    console.log(searchName);
                    console.log(conditionName);
                    console.log(buffMet);
                }*/

                for (var j = 0; j < buffMet.length; j++) {
                    if (buffMet[j]) {
                        buffConditionMet = true;
                        break;
                    }
                }
            }
            else /*if (buffList[i].condition.includes("&"))*/ {
                // include &, everything needs to met.
                for (var j = 0; j < buffMet.length; j++) {
                    if (!buffMet[j]) {
                        buffConditionMet = false;
                    }
                }
            }
        }

        if (buffConditionMet) {
            switch (buffList[i].dbuff) {
                case "SELF_ATK_PERC":   // fall through
                case "PARTY_ATK_PERC":
                case "ALLY_ATK_PERC":
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
                    data.windswept = true;
                    break;
                case "PARTY_ALL_PERC": // add a percertage of stats to the character - like Navi stats
                    let temp = addNaviStats(buffList[i].value);
                    data.atkFlat += temp[0];
                    data.dmgMult += temp[1];
                    data.critRate += temp[2];
                    data.critMult += temp[3];
                    data.pierceRate += temp[4];
                    break;
                case "SEES": // fall through, do nothing, they're simple buffs that have no value
                case "WARM_WELCOME":
                case "FURIOUS_PURSUE":
                    break;
                default:
                    failBuff.push([buffList[i].buffName, buffList[i].dbuff, buffList[i].condition, "N/A"]);
                    break;
            }
        }
        else {
            // for debugging purpose
            failBuff.push([buffList[i].buffName, buffList[i].dbuff, buffList[i].condition, "Failed"]);
        }
    }

    if (failBuff.length > 0) {
        console.log("processDBuffList::Buffs/Debuffs not added.");
        console.log(failBuff);
    }
/*    else {
        console.log("processDBuffList::All buffs were added.");
    }*/
    return data;
}


// add the passive skill the character has to the HTML as soon as they choose a character
// If they don't like the passive buff, they can remove it
// I guess I can add buffs from skill into this... like [Moon Phase],
// and the user can remove it if they don't like it but it may be for another day
// After the buff list is done, I will grab straight from it instead...
function hmtl_addPassiveSkillToBuffList() {

    let dropdown = document.getElementById(htmlDivId);
    var firstChild = dropdown.children[0];  // Save the search Filter

    dropdown.textContent = '';
    dropdown.appendChild(firstChild);   //add back the search field

    outputNameCommon(dropdown, list);

    const targetElement = dropdown;
    var x = targetElement.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");

    document.getElementById(filterHmtlId).value = '';

}

function hmtl_addOthersSkillBuffToBuffList(charName, skill, awareness, skillLevel) {
    // Add other people buff to the list...
    // when I do this, make sure I don't add anything that is self

}

function addWonderBuffToBuffList(name) {
    var buffItem = wonderList.find(item => item.name == name);
    if (buffItem) {
        // this buff is from Wonder
        if (isValidTargetBuff(buffItem.e1dbuff, buffItem.e1condition, buffItem.e1conditionType)) {
            let data = [];
            data.buffName = buffItem.name;
            data.charName = "Wonder";
            data.value = buffItem.e1r0;
            data.dbuff = buffItem.e1dbuff;
            data.condition = buffItem.e1condition;
            data.conditionType = buffItem.e1conditionType;
            buffList.push(data);
        }

        if (isValidTargetBuff(buffItem.e2dbuff, buffItem.e1condition, buffItem.e2conditionType)) {
            let data = [];
            data.buffName = buffItem.name;
            data.charName = "Wonder";
            data.value = buffItem.e2r0;
            data.dbuff = buffItem.e2dbuff;
            data.condition = buffItem.e2condition;
            data.conditionType = buffItem.e2conditionType;
            buffList.push(data);
        }

        if (isValidTargetBuff(buffItem.e3dbuff, buffItem.e3condition, buffItem.e3conditionType)) {
            let data = [];
            data.buffName = buffItem.name;
            data.charName = "Wonder";
            data.value = buffItem.e3r0;
            data.dbuff = buffItem.e3dbuff;
            data.condition = buffItem.e3condition;
            data.conditionType = buffItem.e3conditionType;
            buffList.push(data);
        }

        if (isValidTargetBuff(buffItem.e4dbuff, buffItem.e4condition, buffItem.e4conditionType)) {
            let data = [];
            data.buffName = buffItem.name;
            data.charName = "Wonder";
            data.value = buffItem.e4r0;
            data.dbuff = buffItem.e4dbuff;
            data.condition = buffItem.e4condition;
            data.conditionType = buffItem.e4conditionType;
            buffList.push(data);
        }

        if (isValidTargetBuff(buffItem.e5dbuff, buffItem.e5condition, buffItem.e5conditionType)) {
            let data = [];
            data.buffName = buffItem.name;
            data.charName = "Wonder";
            data.value = buffItem.e5r0;
            data.dbuff = buffItem.e5dbuff;
            data.condition = buffItem.e5condition;
            data.conditionType = buffItem.e5conditionType;
            buffList.push(data);
        }

        if (isValidTargetBuff(buffItem.e6dbuff, buffItem.e6condition, buffItem.e6conditionType)) {
            let data = [];
            data.buffName = buffItem.name;
            data.charName = "Wonder";
            data.value = buffItem.e6r0;
            data.dbuff = buffItem.e6dbuff;
            data.condition = buffItem.e6condition;
            data.conditionType = buffItem.e6conditionType;
            buffList.push(data);
        }

        return true;
    }

    return false;
}

function addUserSelectedBuffToBuffList() {
    //@todo I need to deal with Wonder Knife too... make sure to pass in a reforge value
    for (var i = 0; i < htmlDBuffList.length; i++) {        
        // Check wonder list. If found, move to the next item
        if (addWonderBuffToBuffList(htmlDBuffList[i].name)){
            continue;
        }

        // check skillList next
        if (addSkillBuffToBuffList(htmlDBuffList[i].charName, htmlDBuffList[i].awareness, htmlDBuffList[i].skillLevel, htmlDBuffList[i].name)) {
            continue;
        }

        // weapon and card shouldn't go to user selected buff list.
        // they should be added straight to the buff list themselves
    }
}


// The only time it returns false is if the skillType doesn't match: Wind required but Skill is Fire
// or if it's a self buff
function isValidTargetBuff(dbuff, condition, conditionType) {
    // check if this is a party buff
    if ((dbuff != "") && (dbuff.slice(0, 4) != "SELF")) {
        if ((conditionType != "") && (conditionType != "Debuff") && (conditionType != "Buff")) {
            // buff/debuff is ok, only need to check if this is a skill buff
/*            if (conditionType == "Skill" && condition != iCharInfo.skillType) {
                return false;
            }*/
        }

        // since there is no requirement for this buff, it's valid
        return true;
    }

    return false;
}

// @todo: fix the card database later so less columns...
// It is so trash right now
// @todo: There are some card stuff that does damage... I may need to add to skill list (not skill buff)
function addCardToBuffList(name, charName, role) {
    for (var i = 0; i < cardList.length; i++) {
        if ((cardList[i].name == name)) {
            // Not a dps, then check buff to make sure we don't add self buff
            if (((role == DPS_ROLE) && (cardList[i].e1dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].e1dbuff, cardList[i].e1condition, cardList[i].e1conditionType))) {
                let data = composeBuffData(cardList[i].e1dbuff, charName, SKILL_LEVEL_10, name, cardList[i].e1value, 0, 0, 0, cardList[i].e1condition, cardList[i].e1conditionType)
                buffList.push(data);                
            }

            if (((role == DPS_ROLE) && (cardList[i].e2dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].e2dbuff, cardList[i].e2condition, cardList[i].e2conditionType))) {
                let data = composeBuffData(cardList[i].e2dbuff, charName, SKILL_LEVEL_10, name, cardList[i].e2value, 0, 0, 0, cardList[i].e2condition, cardList[i].e2conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].e3dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].e3dbuff, cardList[i].e3condition, cardList[i].e3conditionType))) {
                let data = composeBuffData(cardList[i].e3dbuff, charName, SKILL_LEVEL_10, name, cardList[i].e3value, 0, 0, 0, cardList[i].e3condition, cardList[i].e3conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].e4dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].e4dbuff, cardList[i].e4condition, cardList[i].e4conditionType))) {
                let data = composeBuffData(cardList[i].e4dbuff, charName, SKILL_LEVEL_10, name, cardList[i].e4value, 0, 0, 0, cardList[i].e4condition, cardList[i].e4conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].s1dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].s1dbuff, cardList[i].s1condition, cardList[i].s1conditionType))) {
                let data = composeBuffData(cardList[i].s1dbuff, charName, SKILL_LEVEL_10, name, cardList[i].s1value, 0, 0, 0, cardList[i].s1condition, cardList[i].s1conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].s2dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].s2dbuff, cardList[i].s2condition, cardList[i].s2conditionType))) {
                let data = composeBuffData(cardList[i].s2dbuff, charName, SKILL_LEVEL_10, name, cardList[i].s2value, 0, 0, 0, cardList[i].s2condition, cardList[i].s2conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].s3dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].s3dbuff, cardList[i].s3condition, cardList[i].s3conditionType))) {
                let data = composeBuffData(cardList[i].s3dbuff, charName, SKILL_LEVEL_10, name, cardList[i].s3value, 0, 0, 0, cardList[i].s3condition, cardList[i].s3conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].s4dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].s4dbuff, cardList[i].s4condition, cardList[i].s4conditionType))) {
                let data = composeBuffData(cardList[i].s4dbuff, charName, SKILL_LEVEL_10, name, cardList[i].s4value, 0, 0, 0, cardList[i].s4condition, cardList[i].s4conditionType)
                buffList.push(data);
            }

            if (((role == DPS_ROLE) && (cardList[i].s5dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardList[i].s5dbuff, cardList[i].s5condition, cardList[i].s5conditionType))) {
                let data = composeBuffData(cardList[i].s5dbuff, charName, SKILL_LEVEL_10, name, cardList[i].s5value, 0, 0, 0, cardList[i].s5condition, cardList[i].s5conditionType)
                buffList.push(data);
            }
        }
    }
}

function addSelfPassiveSkillToBuffList(charInfo) {
    // Add SEES buff
    if (charInfo.isSees) {
        let data = [];
        data.buffName = "SEES";
        data.charName = charInfo.charName;
        data.value = 0;
        data.dbuff = "";
        data.condition = "";
        data.conditionType = "";

        buffList.push(data);
    }

    // Going through the full list to find each passive skill to add
    // NOTE: Commented out since we should just get from the HTML UI instead.
/*    for (var i = 0; i < skillList.length; i++) {
        if ((charInfo.charName == skillList[i].charName) && (skillList[i].skillPos == "Passive")) {
            // Now I have the passive skill name, go though the list again to find the correct awareness/skill

            // Passive skill every level is the same
            addSkillBuffToBuffList(charInfo.charName, charInfo.awareness, SKILL_LEVEL_10, charInfo.skillName);
        }
    }*/    
}

// Since I count by awarenss lowest to highest, the database better be in this order or it will break the code...


function addSkillBuffToBuffList(charName, awareness, skillLevel, skillName) {
    var item = -1;

    // Since I count by awarenss lowest to highest, the database better be in this order or it will break the code...
    for (var i = 0; i < skillList.length; i++) {
        if ((skillList[i].charName == charName) && (skillList[i].skillName == skillName)) {
            if (awareness == skillList[i].awareness) {
                // matching awareness, done
                item = i;
                break;
            }
            else if (skillList[i].awareness > awareness) {
                break;
            }
            else {
                // if awareness is less, keep the highest found awareness, and continue to the next one.
                item = i;
            }
        }
    }

    if (item < 0) {
        console.log("addSkillBuffToBuffList::Skill not found");
        return item; // not found
    }

    let data = composeBuffData(skillList[item].e1dbuff, charName, skillLevel, skillList[item].skillName, skillList[item].e1Lvl10,
        skillList[item].e1Lvl10m5, skillList[item].e1Lvl13, skillList[item].e1Lvl13m5, skillList[item].e1condition, skillList[item].e1conditionType);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e2dbuff, charName, skillLevel, skillList[item].skillName, skillList[item].e2Lvl10,
        skillList[item].e2Lvl10m5, skillList[item].e2Lvl13, skillList[item].e2Lvl13m5, skillList[item].e2condition, skillList[item].e2conditionType);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e3dbuff, charName, skillLevel, skillList[item].skillName, skillList[item].e3Lvl10,
        skillList[item].e3Lvl10m5, skillList[item].e3Lvl13, skillList[item].e3Lvl13m5, skillList[item].e3condition, skillList[item].e3conditionType);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e4dbuff, charName, skillLevel, skillList[item].skillName, skillList[item].e4Lvl10,
        skillList[item].e4Lvl10m5, skillList[item].e4Lvl13, skillList[item].e4Lvl13m5, skillList[item].e4condition, skillList[item].e4conditionType);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e5dbuff, charName, skillLevel, skillList[item].skillName, skillList[item].e5Lvl10,
        skillList[item].e5Lvl10m5, skillList[item].e5Lvl13, skillList[item].e5Lvl13m5, skillList[item].e5condition, skillList[item].e5conditionType);
    if (data.buffName) {
        buffList.push(data);
    }

    data = composeBuffData(skillList[item].e6dbuff, charName, skillLevel, skillList[item].skillName, skillList[item].e6Lvl10,
        skillList[item].e6Lvl10m5, skillList[item].e6Lvl13, skillList[item].e6Lvl13m5, skillList[item].e6condition, skillList[item].e6conditionType);
    if (data.buffName) {
        buffList.push(data);
    }
    
    return item;   // save the index - probably needed for later to calculate skill damage

}
    
// Trash function, but at least it's less copy and paste making it less prone to bug
function composeBuffData(dbuff, charName, skillLevel, name, lvl10, lvl10m5, lvl13, lvl13m5, condition, conditionType) {
    let data = [];

    if ((dbuff != "") && !(dbuff.includes("DMG_SKILL_SINGLE") || dbuff.includes("DMG_SKILL_AOE"))) {
        data.buffName = name;
        data.charName = charName;
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
                console.log("composeBuffData::skillLevel '" + skillLevel + "' not found")
                break;
        }

        data.dbuff = dbuff;
        data.condition = condition;
        data.conditionType = conditionType;
    }

    return data;
}


// using the buff list, add value to it
function addWeaponBuffToBuffList(charName, rarity, reforge, role) {
    for (var i = 0; i < weaponList.length; i++) {
        if ((weaponList[i].charName == charName) && (rarity == weaponList[i].rarity)) {
            // Such trash code... I really could do better than this...
            // should input these in an array when I read the database... seriously...
            if (isValidWeaponBuff(weaponList[i].e1dbuff, weaponList[i].e1condition, weaponList[i].e1conditionType, iCharInfo.skillPos, role)) {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.charName = charName;
                data.value = calcWeaponBasedOnReforge(weaponList[i].e1r0, 0, weaponList[i].e1r2, reforge);
                data.dbuff = weaponList[i].e1dbuff;
                data.condition = weaponList[i].e1condition;
                data.conditionType = weaponList[i].e1conditionType;
                buffList.push(data);
            }

            if (isValidWeaponBuff(weaponList[i].e2dbuff, weaponList[i].e2condition, weaponList[i].e2conditionType, iCharInfo.skillPos, role)) {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.charName = charName;
                data.value = calcWeaponBasedOnReforge(weaponList[i].e2r0, weaponList[i].e2r1, 0, reforge);
                data.dbuff = weaponList[i].e2dbuff;
                data.condition = weaponList[i].e2condition;
                data.conditionType = weaponList[i].e2conditionType;
                buffList.push(data);
            }

            if (isValidWeaponBuff(weaponList[i].e3dbuff, weaponList[i].e3condition, weaponList[i].e3conditionType, iCharInfo.skill, role)) {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.charName = charName;
                data.value = calcWeaponBasedOnReforge(weaponList[i].e3r0, weaponList[i].e3r1, 0, reforge);
                data.dbuff = weaponList[i].e3dbuff;
                data.condition = weaponList[i].e3condition;
                data.conditionType = weaponList[i].e3conditionType;
                buffList.push(data);
            }

            if (isValidWeaponBuff(weaponList[i].e3adbuff, weaponList[i].e3acondition, weaponList[i].e3aconditionType, iCharInfo.skillPos, role)) {
                let data = [];
                data.buffName = weaponList[i].name;    // where the buff is from
                data.charName = charName;
                data.value = calcWeaponBasedOnReforge(weaponList[i].e3ar0, weaponList[i].e3ar1, 0, reforge);
                data.dbuff = weaponList[i].e3adbuff;
                data.condition = weaponList[i].e3acondition;
                data.conditionType = weaponList[i].e3aconditionType;
                buffList.push(data);
            }

            return i;   // save the index
        }
    }    
}
function isValidWeaponBuff(dbuff, condition, conditionType, skill, role) {
    // check for the condition
    if (dbuff != "") {
        if (role != DPS_ROLE) {
            if (!isValidTargetBuff(dbuff, condition, conditionType)) {
                return false;
            }
        }

        if ((condition != "") && (conditionType == "Self Skill")) {
            if (condition.includes(skill)) {
//                console.log(skill)
                return true;
            }
            return false;
        }

        return true;
   }

    return false;
}

// ------------------------------------------------ Code dealing with HTML

function displayResult(dmgPerHit, dmgPerHit2) {
    var element = document.getElementById("result");

    element.innerHTML = "";

    var item = document.createElement("p");
    item.innerHTML = "Damage: ~" + dmgPerHit[0] + " to ~" + dmgPerHit[1] + " per hit. Skill hits " + iCharInfo.final_skillPerc[0].numHit +
        "x for a total of ~" + dmgPerHit[0] * iCharInfo.final_skillPerc[0].numHit + " to ~" + dmgPerHit[1] * iCharInfo.final_skillPerc[0].numHit + ".";
    element.appendChild(item);

    if (dmgPerHit2[0] > 0) {
        item = document.createElement("p");
        item.innerHTML = "In addition, the skill also deals ~" + dmgPerHit2[0] + " to ~" + dmgPerHit2[1] + " per hit. Skill hits " + iCharInfo.final_skillPerc[1].numHit +
            "x for a total of ~" + dmgPerHit2[0] * iCharInfo.final_skillPerc[1].numHit + " to ~" + dmgPerHit2[1] * iCharInfo.final_skillPerc[1].numHit + ".";
        element.appendChild(item);

        item = document.createElement("p");
        item.innerHTML = "Final Damage: ~" + (dmgPerHit[0] * iCharInfo.final_skillPerc[0].numHit + dmgPerHit2[0] * iCharInfo.final_skillPerc[1].numHit)
            + " to ~" + (dmgPerHit[1] * iCharInfo.final_skillPerc[0].numHit + dmgPerHit2[1] * iCharInfo.final_skillPerc[1].numHit) + ".";
        element.appendChild(item);
    }

    item = document.createElement("ul");
    item.setAttribute('class', "w3-ul w3-left-align w3-large");
    var li = document.createElement("li");
    li.innerHTML = "Stats (applied to this skill): ";
    item.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = "Akt: " + iCharInfo.final_atk.toFixed(2);
    item.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = "Dmg Mult: " + iCharInfo.dmgMult.toFixed(2) + "%";
    item.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = "Crit Rate: " + iCharInfo.critRate.toFixed(2) + "%";
    item.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = "Crit Mult: " + iCharInfo.critMult.toFixed(2) + "%";    
    item.appendChild(li);
    li = document.createElement("li");
    li.innerHTML = "Pierce Rate: " + iCharInfo.pierceRate.toFixed(2) + "%";
    item.appendChild(li);
    element.appendChild(item);
}

function getHtmlInfo() {
    iCharInfo.charName = document.getElementById('charName').innerHTML;
    iCharInfo.skillName = document.getElementById('skillChoice').innerHTML; // Will also filter out support skill so only DPS skill is listed
    iCharInfo.awareness = document.getElementById('awarenessChoice').innerHTML;
    iCharInfo.weapon = document.getElementById('weaponChoice').innerHTML;
    iCharInfo.cardSet = document.getElementById('cardChoice').innerHTML;
    iCharInfo.navAtk = parseFloat(document.getElementById('naviAtk').value);

    iCharInfo.atkFlat = 0 + parseFloat(document.getElementById('spaceAtk').value);
    //iCharInfo.atkPerc = 0 + parseFloat(document.getElementById('spaceAtkPercent').value);
    iCharInfo.dmgMult = 0 + parseFloat(document.getElementById('spaceDmgMult').value);
    iCharInfo.critRate = 0 + parseFloat(document.getElementById('spaceCritRate').value);
    iCharInfo.critMult = 0 + parseFloat(document.getElementById('spaceCritMult').value);
    iCharInfo.pierceRate = 0 + parseFloat(document.getElementById('spacePierce').value);  

    iCharInfo.weakness = document.getElementById('enemyElemWeakness').innerHTML;
    iCharInfo.includeCrit = document.getElementById('critChoice').innerHTML;
    iCharInfo.bossName = document.getElementById('bossName').innerHTML;
    iCharInfo.finalBonus = parseFloat(document.getElementById('finalBonus').value);

    iCharInfo.skillLevel = convertSkillLevelTextToValue(document.getElementById('skillLevelChoice').innerHTML);
    iCharInfo.reforgeLevel = convertReforgeLevelTextToValue(document.getElementById('reforgeChoice').innerHTML)

    iCharInfo.skillPos = getSkillPosFromSkillName(iCharInfo.charName, iCharInfo.skillName, skillList);

    let party = [];
    party.charName = document.getElementById('p1charName').innerHTML;
    party.awareness = document.getElementById('p1awarenessChoice').innerHTML;
    party.skillLevel = document.getElementById('p1skillLevelChoice').innerHTML;
    party.weapon = document.getElementById('p1weaponChoice').innerHTML;
    party.reforgeLevel = document.getElementById('p1reforgeChoice').innerHTML;
    party.card = document.getElementById('p1cardChoice').innerHTML;
    partyMembers.push(party);
    party = [];
    party.charName = document.getElementById('p2charName').innerHTML;
    party.awareness = document.getElementById('p2awarenessChoice').innerHTML;
    party.skillLevel = document.getElementById('p2skillLevelChoice').innerHTML;
    party.weapon = document.getElementById('p2weaponChoice').innerHTML;
    party.reforgeLevel = document.getElementById('p2reforgeChoice').innerHTML;
    party.card = document.getElementById('p2cardChoice').innerHTML;
    partyMembers.push(party);
    party = [];
    party.charName = document.getElementById('naviName').innerHTML;
    party.awareness = document.getElementById('naviawarenessChoice').innerHTML;
    party.skillLevel = document.getElementById('naviskillLevelChoice').innerHTML;
    party.weapon = document.getElementById('naviweaponChoice').innerHTML;
    party.reforgeLevel = document.getElementById('navireforgeChoice').innerHTML;
    party.card = document.getElementById('navicardChoice').innerHTML;
    partyMembers.push(party);

    console.log(partyMembers)

    // Add weapon's buffs from party member that the user selected

    // Add card's buffs from party member that the user selected 


    // Add buff/debuffs from HMTL that the user selected to a list so we can process it later.
    htmlProcessDefDebuff('wDBuffOutputDiv', "Wonder", 0, 0);
    htmlProcessDefDebuff('p1DBuffOutputDiv', document.getElementById('p1charName').innerHTML,
                          document.getElementById('p1awarenessChoice').innerHTML,
                          convertSkillLevelTextToValue(document.getElementById('p1skillLevelChoice').innerHTML));
    htmlProcessDefDebuff('p2DBuffOutputDiv', document.getElementById('p2charName').innerHTML,
                            document.getElementById('p2awarenessChoice').innerHTML,
                            convertSkillLevelTextToValue(document.getElementById('p2skillLevelChoice').innerHTML));
    htmlProcessDefDebuff('naviDBuffOutputDiv', document.getElementById('naviName').innerHTML,
                            document.getElementById('naviawarenessChoice').innerHTML,
                            convertSkillLevelTextToValue(document.getElementById('naviskillLevelChoice').innerHTML));
    htmlProcessDefDebuff('dpsDBOutputDiv', iCharInfo.charName, iCharInfo.awareness, iCharInfo.skillLevel);

    // May need to go down to just DefReductionList/DmgMult and Atk/DmgMult list together since some buff does both...
    // Probably have a buff list and a debuff list... that makes the most sense I think...
    // I don't think anything does both buff and debuff...
    // I have to see how I enter info in the database.. I guess

//    console.log(htmlDBuffList);
}


function getSkillPosFromSkillName(charName, skillName, list) {
    for (const item of list) {
        if ((item.charName == charName) && (item.skillName == skillName)) {
            return item.skillPos;
        }
    }

    return "";
}


// Add buff names the user chose to a list so we can add to our processing debuff list later
function htmlProcessDefDebuff(id, charName, awareness, skillLevel) {
    var ulElement = document.getElementById(id);
    el = ulElement.firstElementChild;

    if (!el) {
        // if it's empty, I'm going to auto fill with passive
        getSkillNameListFromDatabaseAndAddItemtoHmtmList(charName, DPS_ROLE, id);
        el = ulElement.firstElementChild;
    }

    while (el) {
        let list = [];
        list.name = el.innerHTML;
        list.charName = charName;
        list.awareness = awareness;
        list.skillLevel = skillLevel;
        htmlDBuffList.push(list);
        el = el.nextElementSibling;
    }    
}

function FillWonderKnife(event) {
    var divSibling = event.target.parentNode.children[1];
    var id = divSibling.id;

    let dropdown = document.getElementById(id);
    dropdown.textContent = '';

    readWonderDatabase();

    outputNameCommon(dropdown, wonderKnifeList);

    var x = dropdown.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");
}

function fillHtmlDBuffList(event) {
    const targetElement = event.target;
    var divSibling = targetElement.parentNode.children[1];

    let dropdown = document.getElementById(divSibling.id);
    var firstChild = dropdown.children[0]; // Save the search Filter

    if (firstChild.nextElementSibling) {
        return;
    }

    dropdown.textContent = '';
    dropdown.appendChild(firstChild); //add back the search field
    var outputDiv = "", listDiv = "", debuffArray = [];

    switch (divSibling.id) {
        case "wDBuffListDiv":
            outputDiv = "wDBuffOutputDiv";
            listDiv = "wDBuffListDiv";
            document.getElementById("userFilterwDBuffList").value = '';
            debuffArray = htmlWonderDbList; // already filled during database read
            break;
        case "dpsDBuffListDiv":
            outputDiv = "dpsDBOutputDiv";
            listDiv = "dpsDBuffListDiv";
            document.getElementById("userFilterDpsDbufflist").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(document.getElementById('charName').innerHTML, DPS_ROLE, outputDiv);
            break;
        case "p1DBuffListDiv":
            outputDiv = "p1DBuffOutputDiv";
            listDiv = "p1DBuffListDiv";
            document.getElementById("userFilterP1DBuffList").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(document.getElementById('p1charName').innerHTML, SUPPORT_ROLE, outputDiv);
            break;
        case "p2DBuffListDiv":
            outputDiv = "p2DBuffOutputDiv";
            listDiv = "p2DBuffListDiv";
            document.getElementById("userFilterP2DBuffList").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(document.getElementById('p2charName').innerHTML, SUPPORT_ROLE, outputDiv);
            break;
        case "naviDBuffListDiv":
            outputDiv = "naviDBuffOutputDiv";
            listDiv = "naviDBuffListDiv";
            document.getElementById("userFilternaviDBuffList").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(document.getElementById('naviName').innerHTML, NAVI_ROLE, outputDiv);
            break;
        default:
            console.log("fillHtmlDBuffList::Cannot find html element");
            outputDiv = "wDBuffOutputDiv";
            listDiv = "wDBuffListDiv";
            document.getElementById("userFilterwDBuffList").value = '';
            break;
    }

    if (debuffArray.length != 0) {
        debuffArray = [...new Set(debuffArray)];

        outputList(dropdown, debuffArray, outputDiv, listDiv);
    }

    var x = dropdown.parentNode.firstElementChild.nextElementSibling;
    x.className = x.className.replace(" w3-hide", "");
}

function getSkillNameListFromDatabaseAndAddItemtoHmtmList(charName, role, outputDiv) {
    let list = [];
    if (role == DPS_ROLE) {
        // only add passive, buff and support
        // if a dps skill hits and gives a self-buff that last more than just that one dps turn
        // it will be record as a buff in the skill database. For example, if Surf 'n' Shine gives
        // Summer Hype state that will increase crit by 9.8 and 29.3, Summer Hype will be a buff
        // that can be used to apply to S1 and S2 also
        for (const skill of skillList) {
            if (skill.charName == charName) {
                if (skill.skillType == "Support") {
                    list.push(skill.skillName);
                }
                else if (skill.skillPos == "Passive") {
                    // We add passive during the process... so maybe don't do it again
                    addItemToListNoButton(skill.skillName, outputDiv);
                }
            }
        }
    }
    else {
        // Other people other than the dps, just add all the passive and support skill
        for (const skill of skillList) {
            if ((skill.charName == charName) &&
                ((skill.skillType == "Passive") || (skill.skillType == "Support"))) {
                if (skill.skillPos == "Passive") {
                    addItemToListNoButton(skill.skillName, outputDiv);
                }
                else {
                    list.push(skill.skillName);
                }
            }
        }
    }

    return list;
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

function convertReforgeLevelTextToValue(text) {
    switch (text) {
        case "R0":
            return 0;
        case "R1":
            return 1;
        case "R2":
            return 2;
        case "R3":
            return 3;
        case "R4":
            return 4;
        case "R5":
            return 5;
        case "R6":
            return 6;
        default:
            console.log("convertReforgeLevelTextToValue::Code does not match html value.")
            return 0;
    }
}

function convertSkillLevelTextToValue(text) {
    switch (text) {
        case "Level 10":
            return SKILL_LEVEL_10;
        case "Level 10 Mindscape 5":
            return SKILL_LEVEL_10_MINDSCAPE_5;
        case "Level 13":
            return SKILL_LEVEL_13;
        case "Level 13 Mindscape 5":
            return SKILL_LEVEL_13_MINDSCAPE_5;
        default:
            console.log("convertSkillLevelTextToValue::Code does not match html value.")
            return SKILL_LEVEL_10;
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

function isValidRole(role, roleName) {
    switch (roleName) {
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

function convertEnemyWeaknessTextToValue(text) {
    switch (text) {
        case "Normal":
            return 1;
        case "Resist":
            return 0.5;
        case "Weakness":
            return 1.2;
        default:
            console.log("Code does not match html value.")
            return 1;
    }
}

function convertEnemyNameToDefenseValue(text) {
    for (var i = 0; i < bossList.length; i++) {
        if (text == bossList[i].name) {
            return bossList[i].defense;
        }
    }

    console.log("convertEnemyNameToDefenseValue::Code does not match html value.")

    return ENEMY_DEFENSE_DEFAULT;
}

function convertEnemyNameToAdditionaDefenseValue(text) {
    for (var i = 0; i < bossList.length; i++) {
        if (text == bossList[i].name) {
            return bossList[i].addtionalDefense;
        }
    }

    console.log("convertEnemyNameToDefenseValue::Code does not match html value.")

    return ENEMY_DEFENSE_ADDITIONAL_DEFAULT;
}

function fillCharacter(event) {
    var divSibling = event.target.parentNode.children[1];
    var id = divSibling.id;

    let dropdown = document.getElementById(id);
    var firstChild = dropdown.children[0];  // Save the search Filter

    dropdown.textContent = '';
    dropdown.appendChild(firstChild);   //add back the search field

    readCharStatDatabase();

    switch (id) {
        case "charListDiv":
            // I'm not going to calculate trash DPS of your support/Wonder
            outputCharName(event, dropdown, charStatList, DPS_ROLE);
            document.getElementById("userFilterCharlist").value = '';
            resetList("dpsDBOutputDiv", false);
            resetList("dpsDBuffListDiv", true);
            break;
        case "p1charListDiv":
            outputCharName(event, dropdown, charStatList, SUPPORT_ROLE);
            document.getElementById("userFilterP1Charlist").value = '';
            resetList("p1DBuffOutputDiv", false);
            resetList("p1DBuffListDiv", true);
            break;
        case "p2charListDiv":
            outputCharName(event, dropdown, charStatList, SUPPORT_ROLE);
            document.getElementById("userFilterP2Charlist").value = '';
            resetList("p2DBuffOutputDiv", false);
            resetList("p2DBuffListDiv", true);
            break;
        case "naviListDiv":
            outputCharName(event, dropdown, charStatList, NAVI_ROLE);
            document.getElementById("userFilterNavilist").value = '';
            resetList("naviDBuffOutputDiv", false);
            resetList("naviDBuffListDiv", true);
            break;
        default:
            break;
    }

    var x = dropdown.parentNode.firstElementChild.nextElementSibling;

    x.className = x.className.replace(" w3-hide", "");
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

function fillBoss(event) {
    let dropdown = document.getElementById("bossListDiv");
    readBossDatabase();

    fillHtmlCommon("bossListDiv", "userFilterBosslist", bossList); 
}

function fillCard(event) {
    readCardDatabase();
    var divSibling = event.target.parentNode.children[1];

    switch (divSibling.id) {
        case "cardListDiv":
            fillHtmlCommon("cardListDiv", "userFilterCardlist", cardList); 
            break;
        case "p1cardListDiv":
            fillHtmlCommon("p1cardListDiv", "userFilterP1Cardlist", cardList);
            break;
        case "p2cardListDiv":
            fillHtmlCommon("p2cardListDiv", "userFilterP2Cardlist", cardList);
            break;
        case "navicardListDiv":
            fillHtmlCommon("navicardListDiv", "userFilterNaviCardlist", cardList);
            break;
        default:
            console.log("fillCard::couldn't find matching html");
            break;
    } 
}

function filterFunctionBoss() {
    filterFunction("userFilterBosslist", "bossListDiv", "a");
}

function filterFunctionName() {
    filterFunction("userFilterCharlist", "charListDiv", "a");
}

function filterFunctionCard() {
    filterFunction("userFilterCardlist", "cardListDiv", "a");
}

function filterFunctionwDBuff() {
    filterFunction("userFilterwDBuffList", "wDBuffListDiv", "a");
}

function filterFunctionAtk() {
    filterFunction("userFilterAtklist", "atkListDiv", "a");
}

function filterFunctionDmg() {
    filterFunction("userFilterDmgList", "dmgListDiv", "a");
}

// --------------- End of HTML Interface ---------------------------------------------------------------------------

// ------------------ Database related -----------------------------------------------------------------------------
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
            data.isSees = row[i][j++];
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
            data.e1conditionType = row[i][j++];
            data.e1dbuff = row[i][j++];

            data.e2r0 = parseFloat(row[i][j++]);
            data.e2r1 = parseFloat(row[i][j++]);
            data.e2condition = row[i][j++];
            data.e2conditionType = row[i][j++];
            data.e2dbuff = row[i][j++];

            data.e3r0 = parseFloat(row[i][j++]);
            data.e3r1 = parseFloat(row[i][j++]);
            data.e3condition = row[i][j++];
            data.e3conditionType = row[i][j++];
            data.e3dbuff = row[i][j++];

            data.e3ar0 = parseFloat(row[i][j++]);
            data.e3ar1 = parseFloat(row[i][j++]);
            data.e3acondition = row[i][j++];
            data.e3aconditionType = row[i][j++];
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

            // Space card bonus
            data.name = row[i][j++];

            data.e1value = parseFloat(row[i][j++]);
            data.e1dbuff = row[i][j++];
            data.e1condition = row[i][j++];    
            data.e1conditionType = row[i][j++];

            data.e2value = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];
            data.e2conditionType = row[i][j++];

            data.e3value = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];
            data.e3conditionType = row[i][j++];

            data.e4value = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];
            data.e4conditionType = row[i][j++];

            // 2 set bonus
            data.s1value = parseFloat(row[i][j++]);
            data.s1dbuff = row[i][j++];
            data.s1condition = row[i][j++];
            data.s1conditionType = row[i][j++];

            // 4 set bonus
            data.s2value = parseFloat(row[i][j++]);
            data.s2dbuff = row[i][j++];
            data.s2condition = row[i][j++];
            data.s2conditionType = row[i][j++];

            data.s3value = parseFloat(row[i][j++]);
            data.s3dbuff = row[i][j++];
            data.s3condition = row[i][j++];
            data.s3conditionType = row[i][j++];

            data.s4value = parseFloat(row[i][j++]);
            data.s4dbuff = row[i][j++];
            data.s4condition = row[i][j++];
            data.s4conditionType = row[i][j++];

            data.s5value = parseFloat(row[i][j++]);
            data.s5dbuff = row[i][j++];
            data.s5condition = row[i][j++];
            data.s5conditionType = row[i][j++];

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
            data.skillName = row[i][j++];
            data.skillType = row[i][j++];    // support or fire or passive

            data.e1Lvl10 = parseFloat(row[i][j++]);
            data.e1Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e1Lvl13 = parseFloat(row[i][j++]);
            data.e1Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e1numHit = parseFloat(row[i][j++]);
            data.e1dbuff = row[i][j++];
            data.e1condition = row[i][j++];
            data.e1conditionType = row[i][j++];

            data.e2Lvl10 = parseFloat(row[i][j++]);
            data.e2Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e2Lvl13 = parseFloat(row[i][j++]);
            data.e2Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e2numHit = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];
            data.e2conditionType = row[i][j++];

            data.e3Lvl10 = parseFloat(row[i][j++]);
            data.e3Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e3Lvl13 = parseFloat(row[i][j++]);
            data.e3Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e3numHit = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];
            data.e3conditionType = row[i][j++];

            data.e4Lvl10 = parseFloat(row[i][j++]);
            data.e4Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e4Lvl13 = parseFloat(row[i][j++]);
            data.e4Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e4numHit = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];
            data.e4conditionType = row[i][j++];

            data.e5Lvl10 = parseFloat(row[i][j++]);
            data.e5Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e5Lvl13 = parseFloat(row[i][j++]);
            data.e5Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e5numHit = parseFloat(row[i][j++]);
            data.e5dbuff = row[i][j++];
            data.e5condition = row[i][j++];
            data.e5conditionType = row[i][j++];

            data.e6Lvl10 = parseFloat(row[i][j++]);
            data.e6Lvl10m5 = parseFloat(row[i][j++]);   // level 10 mindscape 5
            data.e6Lvl13 = parseFloat(row[i][j++]);
            data.e6Lvl13m5 = parseFloat(row[i][j++]);   // level 13 mindscape 5
            data.e6numHit = parseFloat(row[i][j++]);
            data.e6dbuff = row[i][j++];
            data.e6condition = row[i][j++];
            data.e6conditionType = row[i][j++];

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
            data.persona = row[i][j++];
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
            data.e1conditionType = row[i][j++];

            data.e2r0 = parseFloat(row[i][j++]);
            data.e2r1 = parseFloat(row[i][j++]);
            data.e2r2 = parseFloat(row[i][j++]);
            data.e2r3 = parseFloat(row[i][j++]);
            data.e2r4 = parseFloat(row[i][j++]);
            data.e2r5 = parseFloat(row[i][j++]);
            data.e2r6 = parseFloat(row[i][j++]);
            data.e2dbuff = row[i][j++];
            data.e2condition = row[i][j++];
            data.e2conditionType = row[i][j++];

            data.e3r0 = parseFloat(row[i][j++]);
            data.e3r1 = parseFloat(row[i][j++]);
            data.e3r2 = parseFloat(row[i][j++]);
            data.e3r3 = parseFloat(row[i][j++]);
            data.e3r4 = parseFloat(row[i][j++]);
            data.e3r5 = parseFloat(row[i][j++]);
            data.e3r6 = parseFloat(row[i][j++]);
            data.e3dbuff = row[i][j++];
            data.e3condition = row[i][j++];
            data.e3conditionType = row[i][j++];

            data.e4r0 = parseFloat(row[i][j++]);
            data.e4r1 = parseFloat(row[i][j++]);
            data.e4r2 = parseFloat(row[i][j++]);
            data.e4r3 = parseFloat(row[i][j++]);
            data.e4r4 = parseFloat(row[i][j++]);
            data.e4r5 = parseFloat(row[i][j++]);
            data.e4r6 = parseFloat(row[i][j++]);
            data.e4dbuff = row[i][j++];
            data.e4condition = row[i][j++];
            data.e4conditionType = row[i][j++];

            data.e5r0 = parseFloat(row[i][j++]);
            data.e5r1 = parseFloat(row[i][j++]);
            data.e5r2 = parseFloat(row[i][j++]);
            data.e5r3 = parseFloat(row[i][j++]);
            data.e5r4 = parseFloat(row[i][j++]);
            data.e5r5 = parseFloat(row[i][j++]);
            data.e5r6 = parseFloat(row[i][j++]);
            data.e5dbuff = row[i][j++];
            data.e5condition = row[i][j++];
            data.e5conditionType = row[i][j++];

            data.e6r0 = parseFloat(row[i][j++]);
            data.e6r1 = parseFloat(row[i][j++]);
            data.e6r2 = parseFloat(row[i][j++]);
            data.e6r3 = parseFloat(row[i][j++]);
            data.e6r4 = parseFloat(row[i][j++]);
            data.e6r5 = parseFloat(row[i][j++]);
            data.e6r6 = parseFloat(row[i][j++]);
            data.e6dbuff = row[i][j++];
            data.e6condition = row[i][j++];
            data.e6conditionType = row[i][j++];

            wonderList.push(data);

            if (data.type != "Weapon") {
                htmlWonderDbList.push(data.name);
            }
            else {
                wonderKnifeList.push(data);
            }
        }
    }

//    console.log(wonderList);
}

function readBossDatabase() {
    if (bossList[0] != null) {
        return;
    }

    var location = window.location.href;
    var directoryPath = location.substring(0, location.lastIndexOf("/") + 1);

    var result = loadFile(directoryPath + BOSS_FILE_NAME);

    if (result != null) {
        // By lines
        var lines = result.split('\n');

        for (var line = FILE_NUM_SKIP_LINE; line < lines.length; line++) {
            var row = CSVToArray(lines[line], ',');
            var i = 0;
            let data = [];
            var j = 0;

            data.name = row[i][j++];
            data.stage = row[i][j++];
            data.defense = parseFloat(row[i][j++]);
            data.addtionalDefense = parseFloat(row[i][j++]);

            bossList.push(data);
        }
    }
    //    console.log(bossList);
}

