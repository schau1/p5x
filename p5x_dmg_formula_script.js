/*
 * File: p5x_dmg_formula_script.js
 *
 * Description: Main file dealing with HTML interface and the back-end
 * This tool allows user inputs of characters and skills, and calculate
 * the damage based on what the user enters  
 * 
 * Author: schau1 / cantiga
 * 
 * Copyright (c) 2025
 * DO NOT TAKE OR MODIFY MY CODE FOR YOUR USE WITHOUT ASKING 
 * 
*/

// python -m http.server

const DEBUG = 1;

const USE_STAT_SCREEN = 1;      // 0 means use card summary, 1 means use character summary

const ENEMY_DEFENSE_DEFAULT = 363.2;  // doesn't have it - use Dominion value instead
const ENEMY_DEFENSE_ADDITIONAL_DEFAULT = 158.4; // doesn't have it - use NTMR value instead

const FINAL_DMG_BONUS = 1.40;  // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 
const OTHER_DMG_BONUS = 1; // In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. 

const CHAR_STAT_FILE_NAME = encodeURIComponent("P5X database - stat.csv");
const CARD_FILE_NAME = encodeURIComponent("P5X database - card.csv");
const SKILL_FILE_NAME = encodeURIComponent("P5X database - skill.csv");
const WEAPON_FILE_NAME = encodeURIComponent("P5X database - weapon.csv");
const WONDER_FILE_NAME = encodeURIComponent("P5X database - wonder.csv");
const BOSS_FILE_NAME = encodeURIComponent("P5X database - boss.csv");
const FILE_NUM_SKIP_LINE = 2;   // skip the first 2 lines of the csv file
const MAX_NUM_DATABASE_EFFECT = 6;  // database has 6 effects right now
const MAX_NUM_CARD_DATABASE_EFFECT = 9;  // card database has 9 effects right now
const MAX_NUM_WEAP_DATABASE_EFFECT = 4; // weapon database has 4 effects



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
let personaPassive = [];    // mostly used for sim
let personaSkill = [];      // mostly used for sim

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
let extraMath = [];

// Verbose output
let htmlAppliedBuffList = [];

readCardDatabase();
readSkillDatabase();
readWeaponDatabase();
readWonderDatabase();
readBossDatabase();

window.addEventListener("click", function (event) {
    document.querySelectorAll(".w3-dropdown-content").forEach(dropdown => {
        if (!dropdown.parentElement.contains(event.target)) {
            dropdown.classList.remove("w3-show");
        }
    });
});

/**
 *   HMTL function, onClick, will run the damage calculation formula with the user input
 */
function runCalculation() {
    simCommon();

    let dmgPerHit = [];
    var totalMin = 0, totalMax = 0;

    for (const skill of iCharInfo.final_skillPerc) {
        if ((skill.numHit > 0) && skill.skillBehavior != "DoT") {
            let dmg = [];
            dmg = calculateSkillDamage(iCharInfo.final_atk, iCharInfo.final_dmgBonus, iCharInfo.final_defenseReduction, iCharInfo.final_critStableDomain, skill.value, iCharInfo.final_weakness, iCharInfo.finalBonus, OTHER_DMG_BONUS);
            dmg.numHit = skill.numHit;
            dmg.skillBehavior = skill.skillBehavior;
            dmgPerHit.push(dmg);
            totalMin += dmg[0] * dmg.numHit;
            totalMax += dmg[1] * dmg.numHit;
        }
        else if (skill.skillBehavior == "DoT") {
            var hp =  skill.value * 100;
            let dmg = [hp, hp, hp]
            dmg.numHit = skill.numHit;
            dmg.skillBehavior = skill.skillBehavior;
            dmgPerHit.push(dmg);
        }
    }

    displayResult(dmgPerHit, totalMin, totalMax);
    console.log(iCharInfo);
}

function removeFullDuplicates(arr) {
    const map = new Map();
    let hasDuplicate = false;

    for (const obj of arr) {
        const key = JSON.stringify({
            buffName: obj.buffName,
            charName: obj.charName,
            dbuff: obj.dbuff,
            value: obj.value,
            condition: obj.condition,
            conditionType: obj.conditionType
        });

        if (map.has(key)) {
            hasDuplicate = true; // duplicate detected
        } else {
            map.set(key, obj);
        }
    }

    return {
        unique: [...map.values()],
        hasDuplicate
    };
}

/*
*   Combine passive with the persona abilities in the personaList and return a damage score
*
*   @param      passive           must have passive to be combined with item combo
*   @param      personaList       array / list of objects
*
*   @return     damage score of this combo
*/
function damageFn(personaList) {
    // Add buffs and debuffs to everything
    let newDbuffList = [];
    let simCharInfo = structuredClone(iCharInfo);

    for (const persona of personaList) {
        newDbuffList = newDbuffList.concat(persona.dbuff);
    }
    newDbuffList = removeFullDuplicates(newDbuffList);

    if (newDbuffList.hasDuplicate) {
        // if it has duplicate, most likely it's bad anyway, so do this to reduce the time it takes
        return 0;
    }

    let data = processDBuffList(newDbuffList.unique, iCharInfo.skillName, iCharInfo.skillPos, iCharInfo.skillType, iCharInfo.skillBehavior, iCharInfo.numHit);

    simCharInfo.atkFlat += data.atkFlat;
    simCharInfo.atkPerc += data.atkPerc;
    simCharInfo.critMult += data.critMult;
    simCharInfo.critRate += data.critRate;
    simCharInfo.dmgMult += data.dmgMult;
    simCharInfo.pierceRate += data.pierceRate;
    simCharInfo.ampSkill += data.ampSkill;
    simCharInfo.defenseReduction += data.defenseReduction;
    if (data.windswept) {
        simCharInfo.windswept = data.windswept;
    }

    // Final stats calculation
    simCharInfo.final_atk = calculateAtkFinal(simCharInfo.baseAtk, simCharInfo.atkFlat, simCharInfo.atkPerc);
    simCharInfo.final_dmgBonus = calculateDmgBonusFinal(simCharInfo.dmgMult);
    simCharInfo.final_defenseReduction = calculateEnemyDefenseFinal(simCharInfo.enemyDefense, simCharInfo.additionalDefCoef, simCharInfo.windswept, simCharInfo.pierceRate, simCharInfo.defenseReduction);
    simCharInfo.final_weakness = convertEnemyWeaknessTextToValue(simCharInfo.weakness);
    if (simCharInfo.includeCrit == "Yes") {
        simCharInfo.final_critStableDomain = calculateCritStableDomain(simCharInfo.critRate, simCharInfo.critMult);
    }    

    for (const skill of simCharInfo.final_skillPerc) {
       if ((skill.numHit > 0) && skill.skillBehavior != "DoT") {           
           let dmg = calculateSkillDamage(simCharInfo.final_atk, simCharInfo.final_dmgBonus, simCharInfo.final_defenseReduction, simCharInfo.final_critStableDomain, skill.value, simCharInfo.final_weakness, simCharInfo.finalBonus, OTHER_DMG_BONUS);

//         Testing with our original without wonder buff
//         let dmg2 = calculateSkillDamage(iCharInfo.final_atk, iCharInfo.final_dmgBonus, iCharInfo.final_defenseReduction, iCharInfo.final_critStableDomain, skill.value, iCharInfo.final_weakness, iCharInfo.finalBonus, OTHER_DMG_BONUS);
//         console.log(dmg2)
///        console.log(dmg)
           return dmg[0];   // return the min dmg. should be fine.
       }
    }

//    console.log(simCharInfo);
//    console.log(iCharInfo);

    return 0;
}

/**
 *  HMTL function, onClick, will run the simulation formula with the user input
 *  to find the best Persona
 */
function runSimPersona() {
    simCommon();
    let newSkill = [];

    // first, make a new personaSkills list will a combination of all the possible skills
    for (const persona of personaPassive) {
        for (const skill of personaSkill) {
            if ((skill.source == "") || persona.name.includes(skill.source)){
                let item = combinePassiveWithSkill(persona, skill);
                if (item) {
                    newSkill.push(item);
                }
            }
        }
    }

//  Testing with just 1 item
//  damageFn([newSkill[0], newSkill[1], newSkill[2]]);

    // Now we find the best 3 skills
    let result = bestCombinationYielding(newSkill, 3, damageFn, {
        yieldEvery: 2000,
        onProgress: ({ checked, bestScore }) => {
//            console.log("Checked:", checked, "Best:", bestScore);
        }
    }).then(result => {
        // Done. Display the result
        displaySimResult(result);
    });
}

/*
*   Combine persona debuff list with skill list
*
*   @param  persona - persona passive object
*   @param  skill   - persona skill object
*
*/
function combinePassiveWithSkill(persona, skill) {
    if (persona.source != "") {
        // first, add the persona passive first
        let item = [];
        const nameList = persona.name.split("::");
        item.personaName = nameList[0];
        item.personaSkill = [];
        item.personaSkill.push(nameList[1]);
        item.dbuff = [];
        for (const dbuff of persona.dbuff) {
            if (dbuff.dbuff != "") {
                let buff = [];
                buff.buffName = nameList[1];
                buff.charName = item.personaName;
                buff.value = dbuff.r0;
                buff.dbuff = dbuff.dbuff;
                buff.condition = dbuff.condition;
                buff.conditionType = dbuff.conditionType;
                item.dbuff.push(buff);
            }

        }

        // add the skill
        item.personaSkill.push(skill.name);

        for (const dbuff of skill.dbuff) {
            if (dbuff.dbuff != "") {
                let buff = [];
                buff.buffName = skill.name;
                buff.charName = "Wonder";
                buff.value = dbuff.r0;
                buff.dbuff = dbuff.dbuff;
                buff.condition = dbuff.condition;
                buff.conditionType = dbuff.conditionType;
                item.dbuff.push(buff);
            }
        }

        return item;
    }

    return null;
}

/**
 *  Common sim function. This gets html values, initialize from the database, and set up
 *  all the buffs/debuffs into a buff/debuff list and calculate all the necessary value
 *  Note that this uses global variables. Need to be careful.
 *   
 */
function simCommon() {
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
    // add the condition to the user Select buff list instead so that the user can pick them
    // Add all passive skills to the buff List. When I process the list with processDBuffList, 
    // I go through it to see if there is any buff there matching the required buffs.
    // For example, I will go through the list and see this skill requires SEES, then, I will
    // check to see if SEES is found in that list. If not found, I will skip adding the buff stats.
    addSelfPassiveSkillToBuffList(iCharInfo);

    // Using DPS weapon, add to the buff list
    addWeaponBuffToBuffList(iCharInfo.charName, iCharInfo.weapon, iCharInfo.reforgeLevel, DPS_ROLE);

    // Add buffs/debuffs from card set bonus
    addCardToBuffList(iCharInfo.cardSet, iCharInfo.charName, DPS_ROLE);

    // Add Wonder weapon
    addWonderWeaponToBuffList(document.getElementById('wweaponChoice').innerHTML, convertReforgeLevelTextToValue(document.getElementById('wreforgeChoice').innerHTML));

    // Add Weapons from Party Members - Not Wonder... I'll think about Wonder later...
    for (const party of partyMembers) {
        // SUPPORT_ROLE and NAVI_ROLE are the same here
        addWeaponBuffToBuffList(party.charName, party.weapon, party.reforgeLevel, SUPPORT_ROLE);
        addCardToBuffList(party.card, party.charName, SUPPORT_ROLE);
    }

    // Get skills and add buffs from the user selected skill (S1/S3) to buff list
    var skillIndex = addSkillBuffToBuffList(iCharInfo.charName, iCharInfo.awareness, iCharInfo.skillLevel, iCharInfo.skillName, DPS_ROLE);
    if (skillIndex >= 0) {
        // Set the skillType (element or support or passive) to element if we have multiple type
        const element = skillList[skillIndex].skillInfo[0].skillType.split("|");
        for (var item of element) {
            if (item != "Support") {
                iCharInfo.skillType = item;
            }
        }
        iCharInfo.skillBehavior = skillList[skillIndex].skillInfo[0].skillBehavior;
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

    //    console.log(htmlDBuffList)
    // Add boss status to buff list
    addBossStatusToBuffList(iCharInfo.weakness);

    // Add buffs/debuffs from the user selected buff/debuff list
    addUserSelectedBuffToBuffList();

    if (DEBUG) {
        console.table(buffList);
    }

    if (!USE_STAT_SCREEN) {
        // if we are already use the stat screen, we don't need to care about the hidden value
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
    }

    iCharInfo.pierceRate = iCharInfo.pierceRate;
    iCharInfo.baseAtk = 0 + getAtkValueFromAwareness(charStatList[iCharInfo.indexOfCharStatList]) + getWeapAtkValueFromAwareness(charStatList[iCharInfo.indexOfCharStatList]);

    if (USE_STAT_SCREEN) {
        // Subtract out the atkFlat the user entered to get the atk bonus from the card
        iCharInfo.atkFlat = iCharInfo.atkFlat - iCharInfo.baseAtk;
        if (iCharInfo.atkFlat < 0) {
            iCharInfo.atkFlat = iCharInfo.baseAtk;
            console.log("Error::Input Attack is less than base Atk. Using baseAtk as the result.");
        }
    }
    iCharInfo.enemyDefense = convertEnemyNameToDefenseValue(iCharInfo.bossName);
    iCharInfo.additionalDefCoef = convertEnemyNameToAdditionaDefenseValue(iCharInfo.bossName);

    var totalHit = 0;
    for (const info of skillList[skillIndex].skillInfo) {
        // @todo: some skill may have some condition for additional hit...
        // I need to figure out how to handle it... I may need to do 2 passes...
        // One to apply the debuff, then get the skill calculation, then one more to
        // fix anything that skill related...
        if (isDpsSkill(info.skillType)) {
            totalHit += info.numHit;
        }
    }

    // Add buffs and debuffs to everything
    let data = processDBuffList(buffList, iCharInfo.skillName, iCharInfo.skillPos, iCharInfo.skillType, iCharInfo.skillBehavior, skillList[skillIndex].skillInfo[0].numHit, DEBUG);
    iCharInfo.atkFlat += data.atkFlat;
    iCharInfo.atkPerc += data.atkPerc;
    iCharInfo.critMult += data.critMult;
    iCharInfo.critRate += data.critRate;
    iCharInfo.dmgMult += data.dmgMult;
    iCharInfo.pierceRate += data.pierceRate;
    iCharInfo.defenseReduction += data.defenseReduction;
    iCharInfo.windswept = data.windswept;
    iCharInfo.myriad_song = data.myriad_song;
    iCharInfo.extraHit = data.extraHit;
    iCharInfo.ampSkill = data.ampSkill;

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

    // Final Skill calculation
    if (extraMath.length > 0) {
        for (const item of extraMath) {
            if (item.statType = "CR") {
                if (iCharInfo.critRate > 100) {
                    if (item.statBuff = "CM") {
                        iCharInfo.dmgMult += parseFloat(item.multiplier * (iCharInfo.critRate - 100) / 100);
                    }
                    else {
                        console.log("Extra Math statBuff not handled");
                    }
                }
            }
            else {
                console.log("Extra Math statType not handled");
            }
        }
    }

    // Final stats calculation
    iCharInfo.final_atk = calculateAtkFinal(iCharInfo.baseAtk, iCharInfo.atkFlat, iCharInfo.atkPerc);
    iCharInfo.final_dmgBonus = calculateDmgBonusFinal(iCharInfo.dmgMult);
    iCharInfo.final_defenseReduction = calculateEnemyDefenseFinal(iCharInfo.enemyDefense, iCharInfo.additionalDefCoef, iCharInfo.windswept, iCharInfo.pierceRate, iCharInfo.defenseReduction);

    // Skill Perc should be done after all the buffs is done
    iCharInfo.final_skillPerc = calculateSkillPerc(skillList[skillIndex].skillInfo, iCharInfo.skillLevel, iCharInfo.extraHit, iCharInfo.ampSkill);
    iCharInfo.final_weakness = convertEnemyWeaknessTextToValue(iCharInfo.weakness);
    if (iCharInfo.includeCrit == "Yes") {
        iCharInfo.final_critStableDomain = calculateCritStableDomain(iCharInfo.critRate, iCharInfo.critMult);
    }
}

/**
 *  Get Navi stats from HTML and calculate the stats as a percentage of the param
 * @param {any} percent     this is used to get a fraction of the navi stats
 * @returns     [atkFlat, dmgMult, critRate, critMult, pierceRate] from the user entered stats
 */
function addNaviStats(percent) {
    atkFlat = parseFloat(document.getElementById('naviAtk').value) * percent / 100;
    dmgMult = parseFloat(document.getElementById('naviDmgMult').value) * percent / 100;
    critRate = parseFloat(document.getElementById('naviCritRate').value) * percent / 100;
    critMult = parseFloat(document.getElementById('naviCritMult').value) * percent / 100;
    pierceRate = parseFloat(document.getElementById('naviPierce').value) * percent / 100;

    return [atkFlat, dmgMult, critRate, critMult, pierceRate];
}

/**
 * Initialize global variables
 */
function initializeData() {
    buffList = [];
    htmlDBuffList = [];
    partyMembers = [];
    htmlAppliedBuffList = [];
    extraMath = [];

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
    iCharInfo.skillBehavior = "Normal"; // "DoT", "Follow" (Resonane), "Normal"
    iCharInfo.final_weakness = 0;
    iCharInfo.skillLevel = 0;
    iCharInfo.reforgeLevel = 0;
    iCharInfo.final_critStableDomain = 1;
    iCharInfo.isSees = false;
    iCharInfo.finalBonus = 0;
    iCharInfo.myriad_song = false;  // may not really use it, but just in case I want to display the double damage
    iCharInfo.extraHit = 0; // if something modify a dps skill and gives it 1 more hit
    iCharInfo.ampSkill = 1; // multiply with skill. this is for ability that changes skill percentage
}
// Return a list of skill percentage for the skill and its follow up
// @param   skillLevel - the level of the skill: Level 10 skill or Level 13 skill etc
// @param   skill - item containing the skill from the database
// @todo: Assuming the skill has only 2 parts at most. If it's more than 2, need to adjust this code
function calculateSkillPerc(skillInfo, skillLevel, extraHit, ampSkill) {   
    let skillPercList = [];

    for (const skill of skillInfo) {
        if ((skill.dbuff == "DMG_SKILL_SINGLE") || (skill.dbuff == "DMG_SKILL_AOE")
            || skill.dbuff == "DMG_SKILL_DOT_HP") {
            let data = [];
            data.value = 0;
            data.numHit = 0;
            data.skillBehavior = skill.skillBehavior;

            // if the condition is not fulfilled, this skill dmg doesn't exist, just quit
            if ((skill.conditionType == "Exclusive") && IsValidDBuffCondition(skill.condition)) {
                // Invalid skill... this skill doesn't exist
                skillPercList.push(data);
                skillPercList.push(data);
                skillPercList.push(data);
                //            console.log("calculateSkillPerc::Invalid Skill::Check if skill evolves to a different skill");
                return skillPercList;
            }
            else if ((skill.conditionType == "DBuff") && !IsValidDBuffCondition(skill.condition)) {
                // Invalid skill... this skill doesn't exist
                skillPercList.push(data);
                skillPercList.push(data);
                skillPercList.push(data);
                //            console.log("calculateSkillPerc::Invalid Skill::Check if skill requires a buff to be active");
                return skillPercList;
            }

            switch (skillLevel) {
                case SKILL_LEVEL_10:
                    data.value = skill.lvl10;
                    break;
                case SKILL_LEVEL_10_MINDSCAPE_5:
                    data.value = skill.lvl10m5;
                    break;
                case SKILL_LEVEL_13:
                    data.value = skill.lvl13;
                    break;
                case SKILL_LEVEL_13_MINDSCAPE_5:
                    data.value = skill.lvl13m5;
                    break;
                default:
                    data.value = 0;
                    break;
            }
            data.value = data.value / 100 * ampSkill;
            data.numHit = skill.numHit;

            if (extraHit) {
                data.numHit += extraHit;
            }

            skillPercList.push(data);
        }
        else {
            let data = [];
            data.value = 0;
            data.numHit = 0;
            skillPercList.push(data);
            skillPercList.push(data);
        }
    }

    return skillPercList;
}

/**
 *  Check to see if the enemy's debuffs is found in the buff list and is valid
 *  It goes through the full buffList and look for the buff in the buffList
 * 
 * @param   conditionName   the name of the condition we're looking for
 * 
 * @returns true if valid, false if not
 * 
 * */
function IsValidDebuffEnemyCondition(conditionName) {
    if (conditionName != "") {
        for (var i = 0; i < buffList.length; i++) {
            if ((conditionName == "Any") && (buffList[i].buffName != "")) {
                return true;
            }
            if (conditionName == "Elemental Ailment") {
                if ((buffList[i].buffName == "Freeze") || (buffList[i].buffName == "Burn") ||
                    (buffList[i].buffName == "Shock") || (buffList[i].buffName == "Windswept") ||
                    (buffList[i].buffName == "Elemental Ailment")) {
                    return true;
                }
            }
            if (conditionName == "Spiritual Ailment") {
                if ((buffList[i].buffName == "Dizzy") || (buffList[i].buffName == "Forget") ||
                    (buffList[i].buffName == "Despair") || (buffList[i].buffName == "Confuse") ||
                    (buffList[i].buffName == "Fear") || (buffList[i].buffName == "Brainwash") ||
                    (buffList[i].buffName == "Sleep") || (buffList[i].buffName == "Rage") ||
                    (buffList[i].buffName == "Spiritual Ailment")) {
                    return true;
                }
            }
            else if (buffList[i].buffName == conditionName) {
                return true;
            }           
        }
        return false;
    }
    else {
        // it does not have a requirement, so it's fine.
        return true;
    }
}

/**
 *  Check to see the user inflicted debuff/buff is found in the buff list and is valid
 *  It goes through the full buffList and look for the buff in the buffList 
 * 
 * @param   conditionName   the name of the condition we're looking for
 * 
 * @returns true if valid, false if not
 * 
 * */
function IsValidDBuffCondition(conditionName) {
    if (conditionName != "") {
        // this has a requirement, need to go through the buff to see if the user has the buff
        for (var i = 0; i < buffList.length; i++) {
            if (buffList[i].buffName.includes(conditionName)) {
                return true;
            }
        }

        return false;
    }
    else {
        // it does not have a requirement, so it's fine.
        return true;
    }
}

/**
 *  This function handles the NAND (&) operation in the database
 *  It goes through the full buffList and look for the buff in the buffList
 *  Both of the conditions need to be valid for it to return true
 *  If either side of the & is invalid, it will return false
 * 
 * @param   name   the name of the condition we're looking for (name of the buff or debuff)
 * @param   type   the type of the conditon we're looking for (Dbuff or Skill or Debuffed, etc)
 * @param   skillName   the name of the skill that the user enters (that we're trying to find the best DPS for)
 * @param   skill   the skill Position of the skill that the user enters 
 * @param   element the elemment of the skill that the user enters
 * @param   skillBehavior   the behavior the skill that the user enters (DoT, Follow, Normal, etc)
 * 
 * @returns true if valid, false if not
 * 
 * */
function IsValidAndCondition(name, type, skillName, skill, element, skillBehavior, numHit) {
    const searchName = name.split('&'); // conditionName
    const searchType = type.split('&'); // conditionType

    // Handle each of the condition. Since this is an & operation, any false means the whole thing is false, so
    // just return false
     for (var j = 0; j < searchName.length; j++) {
        if (searchType[j]) {
            if (searchType[j].includes("DBuff") || searchType[j].includes("Dbuff")) {
                if (skillName.includes(searchName[j])) {
                    continue;
                }
                else if (!IsValidDBuffCondition(searchName[j])) {
                    return false;
                }
            }
            else if (searchType[j].includes("Self Skill")) {
                // self skill means it only applies to this skill, so check to see if the skill matches
                if (skill != searchName[j]) {
                    return false;
                }
            }
            else if (searchType[j].includes("Element")) {
                if ((element != searchName[j]) && (searchName[j] != "Any")) {
                    return false;
                }
            }
            else if (searchType[j].includes("Exclusive")) {
                if (IsValidDBuffCondition(searchName[j])) {
                    // this is exclusive, meaning that if the buff is on the list, we can't use it
                    return false;
                }
            }
            else if (searchType[j].includes("Skill_Behavior")) {
                if (skillBehavior != searchName[j]) {
                    return false;
                }
            }
            else if (searchType[j].includes("Debuff")) {
                if (!IsValidDebuffEnemyCondition(searchName[j])) {
                    return false;
                }
            }
            else if (searchType[j].includes("NumHit")) {
                if (numHit.toString() != searchName[j]) {
                    return false;
                }
            }
            else if (searchType[j].includes("Chance")) {
                //          not consistent... not sure if we want to include the x% chance to do this
            }
            else {
                // not handled... Maybe I need to do something else in the future
                // because right now, if I set this to true, it will basically ignore 
                // any condition there.... like follow up skill would be assumed to be true
            }
        }
    }

    return true;
}


/* 
* Check the entered list to add up all the values in the buff list
* This will also check the condition to make sure it is ok before it can be added.
* These are the values matching the database
*
* @param   list    the buff list to be added
* @param  skillName   the name of the skill that the user enteres
* @param  skill   the skill position (S1, S2, HL)
* @pram   skillBehavior   how the skill behaves: normal, DoT, Follow
*/
function processDBuffList(list, skillName, skill, element, skillBehavior = "", numHit=0, verbose=false) {
    let data = [];
    data.atkFlat = 0;
    data.atkPerc = 0;
    data.critMult = 0;
    data.critRate = 0;
    data.dmgMult = 0;
    data.pierceRate = 0;
    data.defenseReduction = 0;
    data.windswept = false;
    data.extraHit = 0;
    data.ampSkill = 1;
    let buffConditionMet = true;
    let failBuff = [];  // Just info for now

    for (var i = 0; i < list.length; i++) {
        buffConditionMet = true;

        // Go through the buff list to make sure we meet the condiditon required required before we add it.
        if (list[i].condition != "") {
            // What I should do is split OR first, then send it to a function to split AND
            // and check the AND Result
            const conditionName = list[i].condition.split("|");
            const conditionType = list[i].conditionType.split("|");
            var andResult;

            for (var m = 0; m < conditionName.length; m++) {
                andResult = IsValidAndCondition(conditionName[m], conditionType[m], skillName, skill, element, skillBehavior, numHit);

                if (andResult) {
                    // Since this is an OR operation, any true result means the final result is true
                    break;
                }
            }

            if (andResult) {
                buffConditionMet = true;
            }
            else {
                buffConditionMet = false;
            }
        }

        if (buffConditionMet) {
            switch (list[i].dbuff) {
                case "OOB_SELF_ATK_PERC":   // out of battle
                    if (USE_STAT_SCREEN) {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Counted"]);
                        break;              // if use stat screen, bonus already accounted for, so don't add again.
                    }                       // if not, fall through
                case "SELF_ATK_PERC":   // fall through
                case "PARTY_ATK_PERC":
                case "ALLY_ATK_PERC":
                case "ALLIES_ATK_PERC":
                case "SELF_N_ALLY_ATK_PERC":
                    data.atkPerc += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Increase ATK Percent", list[i].value]);
                    break;
                case "ALLY_ATK_PERC_HL":
                    if (skill == "Highlight") {
                        data.atkPerc += list[i].value;
                        htmlAppliedBuffList.push([list[i].buffName, "Increase ATK Percent for HL", list[i].value]);
                    }
                    else {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Failed"]);
                    }
                    break;
                case "ALLY_DMG_PERC_HL":
                    if (skill == "Highlight") {
                        data.dmgMult += list[i].value;
                        htmlAppliedBuffList.push([list[i].buffName, "Increase Damage for HL", list[i].value]);
                    }
                    else {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Failed"]);
                    }
                    break;
                case "OOB_SELF_ATK_FLAT":   // out of battle
                    if (USE_STAT_SCREEN) {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Counted"]);
                        break;              // if use stat screen, bonus already accounted for, so don't add again.
                    }                       // if not, fall through
                case "SELF_ATK_FLAT":   // fall through
                case "PARTY_ATK_FLAT":   // fall through
                case "ALLY_ATK_FLAT":
                    data.atkFlat += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Increase ATK Flat", list[i].value]);
                    break;
                case "OOB_SELF_CRIT_MULT_PERC":   // out of battle
                    if (USE_STAT_SCREEN) {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Counted"]);
                        break;              // if use stat screen, bonus already accounted for, so don't add again.
                    }                       // if not, fall through
                case "SELF_CRIT_MULT_PERC":   // fall through
                case "ALLIES_CRIT_MULT_PERC":   // fall through
                case "PARTY_CRIT_MULT_PERC":   // fall through
                case "ALLY_CRIT_MULT_PERC":
                case "SELF_N_ALLY_CRIT_MULT_PERC":
                    data.critMult += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Increase Crit Damage", list[i].value]);
                    break;
                case "ALLY_CRIT_MULT_PERC_CR_OVER_100":
                    let item = [];
                    item.statType = "CR";
                    item.statBuff = "CM";
                    item.multiplier = list[i].value;
                    extraMath.push(item);
                    htmlAppliedBuffList.push([list[i].buffName, "Increase Crit Damage With Crit Rate Multiplier", list[i].value]);
                    break;
                case "OOB_SELF_CRIT_PERC":   // out of battle
                    if (USE_STAT_SCREEN) {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Counted"]);
                        break;              // if use stat screen, bonus already accounted for, so don't add again.
                    }                       // if not, fall through
                case "SELF_CRIT_PERC":   // fall through
                case "PARTY_CRIT_PERC":   // fall through
                case "ALLY_CRIT_PERC":
                case "ALLIES_CRIT_PERC":
                case "SELF_N_ALLY_CRIT_PERC":
                    data.critRate += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Increase Crit Rate", list[i].value]);
                    break;
                case "OOB_SELF_DMG_PERC":   // out of battle
                    if (USE_STAT_SCREEN) {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Counted"]);
                        break;              // if use stat screen, bonus already accounted for, so don't add again.
                    }                       // if not, fall through
                case "SELF_DMG_PERC":   // fall through
                case "PARTY_DMG_PERC":   // fall through
                case "ALLY_DMG_PERC":
                    data.dmgMult += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Increase Damage", list[i].value]);
                    break;
                case "OOB_SELF_PIERCE_PERC":   // out of battle
                    if (USE_STAT_SCREEN) {
                        failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Counted"]);
                        break;              // if use stat screen, bonus already accounted for, so don't add again.
                    }                       // if not, fall through
                case "SELF_PIERCE_PERC":   // fall through
                case "PARTY_PIERCE_PERC":   // fall through
                case "ALLY_PIERCE_PERC":
                case "SELFN_ALLY_PIERCE_PERC":
                    data.pierceRate += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Increase Pierce Rate", list[i].value]);
                    break;
                case "DEF_DECR_PERC":   // fall through
                case "DEF_DECR_PERC_AOE":
                    data.defenseReduction += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Decrement Enemy Defense", list[i].value]);
                    break;
                case "WINDSWEEP_AOE":   // fall through
                case "WINDSWEEP":   // fall through
                    data.windswept = true;
                    htmlAppliedBuffList.push([list[i].buffName, "Windswept", data.windswept]);
                    break;
                case "SHOCKED":    // Elemental Ailments
                case "ELEMENTAL_AILMENT":
                    break;
                case "NON_ELEMENTAL_AILMENT": // other status
                    break;
                case "SPIRITUAL_AILMENT":   // ???
                    break;
                case "PARTY_ALL_PERC": // add a percertage of stats to the character - like Navi stats
                    let temp = addNaviStats(list[i].value);
                    data.atkFlat += temp[0];
                    data.dmgMult += temp[1];
                    data.critRate += temp[2];
                    data.critMult += temp[3];
                    data.pierceRate += temp[4];
                    htmlAppliedBuffList.push([list[i].buffName, "Increase all Stats by X% Navi Stats", buffList[i].value]);
                    break;
                case "SELF_SKILL_HIT_INC":  // add the number of hits to the skill
                    data.extraHit += list[i].value;
                    htmlAppliedBuffList.push([list[i].buffName, "Extra hit", list[i].value]);
                    break;
                case "ALLY_SKILL_AMP_PERC":
                    data.ampSkill += list[i].value/100;
                    htmlAppliedBuffList.push([list[i].buffName, "Skill Amplification", list[i].value]);
                    break;
                case "SEES": // fall through, do nothing, they're simple buffs that have no value
//                case "WARM_WELCOME":
//                case "FURIOUS_PURSUE":
                case "NO_VALUE_BUFF":
                case "HIGHLIGHT_CHARGE_INC":    // increase highlight
                case "PARTY_DMG_TAKEN_DEC":     // decrease dmg taken
                case "SELF_DMG_TAKEN_DEC":
                case "SELF_DBUFF_CHANCE":       // chance of self buff
                case "ALLY_HEAL_PERC_CHANCE":
                case "ALLY_SHIELD_HP":          // shield based on HP
                case "PARTY_SHIELD_REC_PERC":
                case "PARTY_HEAL_REC_PERC":     // increase heals received
                case "PARTY_EHR_RES_PERC":      // ailment resistance
                case "ALLY_SHIELD_REC_PERC":    // increase shield received
                case "FOE_ATK_DEC_PERC":        // decrease enemy's atk
                case "PARTY_SP_RES":            // restore sp
                case "SELF_HEAL_SKILL":
                case "HEAL_SKILL_SINGLE_FLAT":
                    break;
                case "PARTY_DEF_PERC":  // fall through, future development
                case "PARTY_EHR_PERC":
                case "ALLY_EHR_PERC":
                case "ALLY_DEF_PERC":
                case "SELF_DEF_PERC":
                case "SELF_SPD_PERC":
                case "SELF_EHR_PERC":
                case "PARTY_HP_PERC":
                case "PARTY_HP_FLAT":
                case "ALLY_HP_FLAT":
                case "BLOSSOM":
                case "HOLY_SONG":   // buffs by the number of stacks so I may want to add later
                    break;
                case "MYRIAD_SONG":
                    data.myriad_song = true;
                    break;
                default:
                    failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "N/A"]);
                    break;
            }
        }
        else {
            // for debugging purpose
            failBuff.push([list[i].buffName, list[i].dbuff, list[i].condition, list[i].conditionType, "Failed"]);
        }
    }

    if (failBuff.length > 0 && verbose) {
        console.log(failBuff);
    }

    return data;
}

/**
 * Add WonderBuff to the buff List
 * 
 * @param   name    name of the buff
 * 
 */
function addWonderBuffToBuffList(name) {
    var buffItem = wonderList.find(item => item.name == name);
    if (buffItem) {
        // this buff is from Wonder
        for (var buff of buffItem.dbuff) {
            if (isValidTargetBuff(buff.dbuff, buff.condition, buff.conditionType)) {
                let data = [];
                data.buffName = buffItem.name;
                data.charName = "Wonder";
                data.value = buff.r0;
                data.dbuff = buff.dbuff;
                data.condition = buff.condition;
                data.conditionType = buff.conditionType;
                buffList.push(data);
            }
        }

        return true;
    }

    return false;
}

/**
 * Add user selected buff to the global buffList
 * The user selected buffs are stored in htmlDBuffList
 * 
 */
function addUserSelectedBuffToBuffList() {
    for (var i = 0; i < htmlDBuffList.length; i++) {        
        // Check wonder list. If found, move to the next item
        if (addWonderBuffToBuffList(htmlDBuffList[i].name)){
            continue;
        }

        var role;

        if (htmlDBuffList[i].charName == iCharInfo.charName) {
            role = DPS_ROLE;
        }
        else {
            role = SUPPORT_ROLE;
        }

        // remove the skill from the list first since we already took the buff from this skill
        // to avoid duplicate
        htmlDBuffList = htmlDBuffList.filter(item => item.name !== iCharInfo.skillName);

        const item = addSkillBuffToBuffList(htmlDBuffList[i].charName, htmlDBuffList[i].awareness, htmlDBuffList[i].skillLevel, htmlDBuffList[i].name, role);
        // check skillList next
        if (item) {
            continue;
        }
    }
}


// The only time it returns false is if the skillType doesn't match: Wind required but Skill is Fire
// or if it's a self buff
// TargetBuff means this buff is supposed to impact someone else and not self
function isValidTargetBuff(dbuff, condition, conditionType) {
    // check if this is a party buff
    if ((dbuff != "") && !dbuff.includes("SELF_")) {
        if ((conditionType != "") && (conditionType != "Debuff") && (conditionType != "Buff")) {
            // buff/debuff is ok, only need to check if this is a skill buff
            // Add to the list... Can check if valid skill by processing the list
/*            if (conditionType == "Skill" && condition != iCharInfo.skillType) {
                return false;
            }*/
        }

        // since there is no requirement for this buff, it's valid
        return true;
    }

    return false;
}

function addBossStatusToBuffList(weakness) {
    if (weakness == "Weakness") {
        let data = [];
        data.buffName = iCharInfo.weakness;
        data.charName = "Boss";
        data.value = 0;
        data.dbuff = "NO_VALUE_BUFF";
        data.condition = ""
        data.conditionType = "";
        buffList.push(data);
    }
}

// @todo: There are some card stuff that does damage... I may need to add to skill list (not skill buff)
function addCardToBuffList(name, charName, role) {
    for (const card of cardList) {   
        if (card.name == name) {
            for (const cardInfo of card.cardInfo) {
                // Not a dps, then check buff to make sure we don't add self buff
                if (((role == DPS_ROLE) && (cardInfo.dbuff != "")) || ((role != DPS_ROLE) && isValidTargetBuff(cardInfo.dbuff, cardInfo.condition, cardInfo.conditionType))) {
                    let data = composeBuffData(cardInfo.dbuff, charName, SKILL_LEVEL_10, name, cardInfo.value, 0, 0, 0, cardInfo.condition, cardInfo.conditionType)
                    if (data.buffName) {
                        buffList.push(data);
                    }
                }
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
        data.dbuff = "NO_VALUE_BUFF";   // these are added as a condition to trigger other buffs
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


function addSkillBuffToBuffList(charName, awareness, skillLevel, skillName, role) {
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
                // This is the case when we have like an a6 but the skill only changes at a2, so we keep the a2 skill
                break;
            }
            else {
                // if awareness is less, keep the highest found awareness, and continue to the next one.
                item = i;
            }
        }
    }

    if (item < 0) {
        console.log("addSkillBuffToBuffList::" + skillName + " not found");
        return item; // not found
    }

    // Some skill spans more than 1 line, or has multiple condition to fullfill
    // if the awareness isn't matching, like it's looking for a2 but a1 is the max
    // that we found. let's check the previous to make sure the previous also works
    var current = item;
    for (var i = item; i > 0; i--) {
        if ((skillList[i].awareness != skillList[item].awareness) || (skillList[i].skillName != skillList[item].skillName)) {
            current = i+1;
            break;
        }
    }

    while ((skillList[current].awareness == skillList[item].awareness) && (skillList[current].skillName == skillList[item].skillName)) {
        for (const skillInfo of skillList[current].skillInfo) {
            if ((role == DPS_ROLE) || isValidTargetBuff(skillInfo.dbuff, skillInfo.condition, skillInfo.conditionType)) {
                let data = composeBuffData(skillInfo.dbuff, charName, skillLevel, skillList[current].skillName, skillInfo.lvl10,
                    skillInfo.lvl10m5, skillInfo.lvl13, skillInfo.lvl13m5, skillInfo.condition, skillInfo.conditionType);
                if (data.buffName) {
                    buffList.push(data);
                }
            }
        }        

        current++;
    }
    
    return item;   // save the index - probably needed for later to calculate skill damage
}
    
// Trash function, but at least it's less copy and paste making it less prone to bug
function composeBuffData(dbuff, charName, skillLevel, name, lvl10, lvl10m5, lvl13, lvl13m5, condition, conditionType) {
    let data = [];

    if ((dbuff != "") && !(dbuff.includes("DMG_SKILL_SINGLE") || dbuff.includes("DMG_SKILL_AOE")
        || dbuff.includes("HEAL_SKILL_") || dbuff.includes("SHIELD_SKILL"))) {
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
            for (const info of weaponList[i].weapInfo) {
                if (isValidWeaponBuff(info.dbuff, info.condition, info.conditionType, iCharInfo.skillPos, role)) {
                    let data = [];
                    data.buffName = weaponList[i].name;    // where the buff is from
                    data.charName = charName;
                    data.value = calcWeaponBasedOnReforge(info.r0, 0, info.r2, reforge);
                    data.dbuff = info.dbuff;
                    data.condition = info.condition;
                    data.conditionType = info.conditionType;
                    buffList.push(data);
                }
            }
//            return i;   // save the index
        }
    }    
}

function addWonderWeaponToBuffList(name, reforge) {
    for (const weapon of wonderList) {      
        if (weapon.name.includes(name)) {

            for (var buff of weapon.dbuff) {
                if (isValidTargetBuff(buff.dbuff, buff.condition, buff.conditionType)) {
                    let data = [];
                    data.buffName = weapon.name;
                    data.charName = "Wonder";
                    data.value = getWonderWeaponStatBasedOnReforge(reforge, buff.r0, buff.r1, buff.r2, buff.r3, buff.r4, buff.r5, buff.r6)
                    data.dbuff = buff.dbuff;
                    data.condition = buff.condition;
                    data.conditionType = buff.conditionType;
                    buffList.push(data);
                }
            }
        }
    }    
     //   console.log("addWonderWeaponToBuffList::Couldn't find Wonder's Knife: " + name);
}

function getWonderWeaponStatBasedOnReforge(reforgeLevel, r0, r1, r2, r3, r4, r5, r6) {
    switch (reforgeLevel) {
        case 0:
            return parseFloat(r0.toFixed(2));
        case 1:
            return parseFloat(r1.toFixed(2));
        case 2:
            return parseFloat(r2.toFixed(2));
        case 3:
            return parseFloat(r3.toFixed(2));
        case 4:
            return parseFloat(r4.toFixed(2));
        case 5:
            return parseFloat(r5.toFixed(2));
        case 6:
            return parseFloat(r6.toFixed(2));
        default:
            return parseFloat(r0.toFixed(2));    
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

function displaySimResult(result) {
    var element = document.getElementById("result");
    // Clear the output if the user wants to
    if (document.getElementById('checkClrOutput').checked) {
        element.innerHTML = "";
    }

//    console.log(result);

    for (const persona of result.bestCombo) {
        var item = document.createElement("p");
        item.innerHTML = "\t- " + persona.personaName + "::" + persona.personaSkill[0] + " and " + persona.personaSkill[1];
        element.prepend(item);
    }

    var item = document.createElement("p");
    item.innerHTML = "Best Persona Combo: ";
    element.prepend(item);

    item = document.createElement("p");
    item.innerHTML = "Skill:: " + iCharInfo.skillName + ". Party::" + iCharInfo.charName + "::" + iCharInfo.awareness + "R" + iCharInfo.reforgeLevel + " " + iCharInfo.weapon + ". ";
    for (const party of partyMembers) {
        item.innerHTML += party.charName + "::" + party.awareness + party.reforgeLevel + " " + party.weapon + ". ";
    }

    var firstChild = document.getElementById('wDBuffOutputDiv').firstElementChild;
    item.innerHTML += "Wonder: " + document.getElementById('wweaponChoice').innerHTML + " " + document.getElementById('wreforgeChoice').innerHTML + " ";

    while (firstChild) {
        item.innerHTML += firstChild.innerHTML + " ";
        firstChild = firstChild.nextElementSibling;
    }

    element.prepend(item);

    item = document.createElement("p");
    item.innerHTML = "---------------- RESULT ------------------";
    element.prepend(item);
}

function displayResult(dmgList, min, max) {
    var element = document.getElementById("result");
    // Clear the output if the user wants to
    if (document.getElementById('checkClrOutput').checked) {
        element.innerHTML = "";
    }

    //    var item = document.createElement("p");
    var item;

    if (dmgList[0].skillBehavior != "DoT" && dmgList[0][0] == 0) {
        item = document.createElement("p");
        item.innerHTML = "Error: Invalid Skill. Skill may requires a buff to be active or has evolved to a different skill. Please check skill condition.";
        element.prepend(item);

        return;
    }

    if (document.getElementById('chkDetailOutput').checked) {
        item = document.createElement("ul");
        item.setAttribute('class', "w3-ul w3-left-align w3-large");
        var li = document.createElement("li");
        li.innerHTML = "Stats (applied ONLY while using this skill): ";
        item.appendChild(li);
        li = document.createElement("li");
        li.innerHTML = "Atk: " + iCharInfo.final_atk.toFixed(1);
//        item.appendChild(li);
//        li = document.createElement("li");
        li.innerHTML += "\t\t\t\tDmg Mult: " + iCharInfo.dmgMult.toFixed(1) + "%";
        item.appendChild(li);
        li = document.createElement("li");
        li.innerHTML = "Crit Rate: " + iCharInfo.critRate.toFixed(1) + "%";
//        item.appendChild(li);
//        li = document.createElement("li");
        li.innerHTML += "\t\t\tCrit Mult: " + iCharInfo.critMult.toFixed(1) + "%";
        item.appendChild(li);
        li = document.createElement("li");
        li.innerHTML = "Pierce Rate: " + iCharInfo.pierceRate.toFixed(1) + "%";
//        item.appendChild(li);
//        li = document.createElement("li");
        li.innerHTML += "\t\t\tDefense Reduction: " + iCharInfo.final_defenseReduction.toFixed(1);
        item.appendChild(li);
        if (iCharInfo.final_defenseReduction == 1) {
            li = document.createElement("li");
            li.innerHTML = "Too many defense down. You hit the max limit. Consider using less defense reduction ability.";
            item.appendChild(li);
        }
        item.appendChild(li);
        element.prepend(item);
    }

    if (document.getElementById('chkDBuffOutput').checked) {
        item = document.createElement("ul");
        item.setAttribute('class', "w3-ul w3-left-align w3-large");
        var li = document.createElement("li");
        li.innerHTML = "Applied Buffs: ";
        item.appendChild(li);

        for (const buff of htmlAppliedBuffList) {
            var li = document.createElement("li");
            item.innerHTML += buff[0] + "::" + buff[1] + "::" + buff[2];
            item.appendChild(li);
        }

        element.prepend(item);
    }

    item = document.createElement("p");
    item.innerHTML = "Final damage on main target: ~" + min + " to ~" + max + " + any DoT (if listed above).";
    element.prepend(item);

    item = document.createElement("p");
//    item.innerHTML = "The skill deals ";

    for (const dmgPerHit of dmgList) {
        if (dmgPerHit.skillBehavior != "DoT") {
            item.innerHTML += "The skill deals ~" + dmgPerHit[0] + " to ~" + dmgPerHit[1] + " per hit, total " + dmgPerHit.numHit + " hit(s). ";
        }
        else {
            item.innerHTML += "The skill deals " + dmgPerHit[0] + "% of the enemy's HP " + dmgPerHit.numHit + " time(s). "
        }
    }

    element.prepend(item);

    item = document.createElement("p");
    item.innerHTML = "Skill:: " + iCharInfo.skillName + ". Party::" + iCharInfo.charName + "::" + iCharInfo.awareness + "R" + iCharInfo.reforgeLevel + " " + iCharInfo.weapon + ". ";
    for (const party of partyMembers) {
        item.innerHTML += party.charName + "::" + party.awareness + party.reforgeLevel + " " + party.weapon + ". ";
    }

    var firstChild = document.getElementById('wDBuffOutputDiv').firstElementChild;
    item.innerHTML += "Wonder: " + document.getElementById('wweaponChoice').innerHTML + " " + document.getElementById('wreforgeChoice').innerHTML + " ";

    while (firstChild) {
        item.innerHTML += firstChild.innerHTML + " ";
        firstChild = firstChild.nextElementSibling;
    }   

    element.prepend(item);

    item = document.createElement("p");
    item.innerHTML = "---------------- RESULT ------------------";
    element.prepend(item);
}

function getHtmlInfo() {
    iCharInfo.charName = document.getElementById('charName').innerHTML.replaceAll("&amp;", "&");
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
    party.charName = document.getElementById('p1charName').innerHTML.replaceAll("&amp;", "&");
    party.awareness = document.getElementById('p1awarenessChoice').innerHTML;
    party.skillLevel = document.getElementById('p1skillLevelChoice').innerHTML;
    party.weapon = document.getElementById('p1weaponChoice').innerHTML;
    party.reforgeLevel = document.getElementById('p1reforgeChoice').innerHTML;
    party.card = document.getElementById('p1cardChoice').innerHTML;
    partyMembers.push(party);
    party = [];
    party.charName = document.getElementById('p2charName').innerHTML.replaceAll("&amp;", "&");
    party.awareness = document.getElementById('p2awarenessChoice').innerHTML;
    party.skillLevel = document.getElementById('p2skillLevelChoice').innerHTML;
    party.weapon = document.getElementById('p2weaponChoice').innerHTML;
    party.reforgeLevel = document.getElementById('p2reforgeChoice').innerHTML;
    party.card = document.getElementById('p2cardChoice').innerHTML;
    partyMembers.push(party);
    party = [];
    party.charName = document.getElementById('naviName').innerHTML.replaceAll("&amp;", "&");
    party.awareness = document.getElementById('naviawarenessChoice').innerHTML;
    party.skillLevel = document.getElementById('naviskillLevelChoice').innerHTML;
    party.weapon = document.getElementById('naviweaponChoice').innerHTML;
    party.reforgeLevel = document.getElementById('navireforgeChoice').innerHTML;
    party.card = document.getElementById('navicardChoice').innerHTML;
    partyMembers.push(party);

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
    htmlProcessDefDebuff('bossDBuffOutputDiv', document.getElementById('bossName').innerHTML, 0, 0);

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
        getSkillNameListFromDatabaseAndAddItemtoHmtmList(awareness, charName, DPS_ROLE, id);
        el = ulElement.firstElementChild;
    }

    while (el) {
        let list = [];
        list.name = el.innerHTML.replaceAll("&amp;", "&");
        list.charName = charName.replaceAll("&amp;", "&");
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

    toggleDropdown(id);
}

function fillHtmlDbuffList_Common(id) {
    var outputDiv = "", listDiv = "", debuffArray = [];
    let dropdown = document.getElementById(id);

    var firstChild = dropdown.children[0]; // Save the search Filter

    if (firstChild) {
        if (firstChild.nextElementSibling) {
            /*            if (document.getElementById("wDBuffOutputDiv").firstElementChild &&
                            document.getElementById("p1DBuffOutputDiv").firstElementChild &&
                            document.getElementById("p2DBuffOutputDiv").firstElementChild &&
                            document.getElementById("naviDBuffOutputDiv").firstElementChild) {*/
//            return;
            //            }
        }
        dropdown.textContent = '';
        dropdown.appendChild(firstChild); //add back the search field
    }   

    switch (id) {
        case "wDBuffListDiv":
            outputDiv = "wDBuffOutputDiv";
            listDiv = "wDBuffListDiv";
            document.getElementById("userFilterwDBuffList").value = '';
            debuffArray = htmlWonderDbList; // already filled during database read
            break;
        case "dpsDBuffListDiv":
            outputDiv = "dpsDBOutputDiv";
            listDiv = "dpsDBuffListDiv";
            var awareness = document.getElementById('awarenessChoice').innerHTML;
            document.getElementById("userFilterDpsDbufflist").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(awareness, document.getElementById('charName').innerHTML, DPS_ROLE, outputDiv);
            break;
        case "p1DBuffListDiv":
            outputDiv = "p1DBuffOutputDiv";
            listDiv = "p1DBuffListDiv";
            var awareness = document.getElementById('p1awarenessChoice').innerHTML;
            document.getElementById("userFilterP1DBuffList").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(awareness, document.getElementById('p1charName').innerHTML, SUPPORT_ROLE, outputDiv);
            break;
        case "p2DBuffListDiv":
            outputDiv = "p2DBuffOutputDiv";
            listDiv = "p2DBuffListDiv";
            var awareness = document.getElementById('p2awarenessChoice').innerHTML;
            document.getElementById("userFilterP2DBuffList").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(awareness, document.getElementById('p2charName').innerHTML, SUPPORT_ROLE, outputDiv);
            break;
        case "naviDBuffListDiv":
            outputDiv = "naviDBuffOutputDiv";
            listDiv = "naviDBuffListDiv";
            var awareness = document.getElementById('naviawarenessChoice').innerHTML;
            document.getElementById("userFilternaviDBuffList").value = '';
            debuffArray = getSkillNameListFromDatabaseAndAddItemtoHmtmList(awareness, document.getElementById('naviName').innerHTML, NAVI_ROLE, outputDiv);
            break;
        case "bossDBuffListDiv":
            outputDiv = "bossDBuffOutputDiv";
            listDiv = "bossDBuffListDiv";
            debuffArray = ["Windswept", "Shock", "Burn", "Freeze", "Curse", "Spiritual Ailment"];
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

    toggleDropdown(id);
}

function fillHtmlDBuffList(event) {
    const targetElement = event.target;
    var divSibling = targetElement.parentNode.children[1];

    fillHtmlDbuffList_Common(divSibling.id);
}

function getSkillNameListFromDatabaseAndAddItemtoHmtmList(awareness, charName, role, outputDiv) {
    let list = [];

    charName = charName.replaceAll("&amp;", "&");

    if (role == DPS_ROLE) {
        // only add passive, buff and support
        // if a dps skill hits and gives a self-buff that last more than just that one dps turn
        // it will be record as a buff in the skill database. For example, if Surf 'n' Shine gives
        // Summer Hype state that will increase crit by 9.8 and 29.3, Summer Hype will be a buff
        // that can be used to apply to S1 and S2 also
        for (const skill of skillList) {
            if (skill.charName == charName) {
                if ((skill.skillInfo[0].skillType.includes("Support")) && (skill.awareness <= awareness)) {
                    list.push(skill.skillName);
                }
                else if ((skill.skillPos == "Passive") && (skill.awareness <= awareness)) {
                    // We add passive during the process... so maybe don't do it again
                    addItemToListNoButton(skill.skillName, outputDiv);
                }
            }
        }
    }
    else {
        // Other people other than the dps, just add all the passive and support skill
        for (const skill of skillList) {
            if ((skill.charName == charName) && (skill.awareness <= awareness) &&
                ((skill.skillInfo[0].skillType == "Passive") || skill.skillInfo[0].skillType.includes("Support"))) {
                if (skill.skillInfo[0].skillType == "Passive") {
                    // Add item to the output instead of letting the user choose since it's a passive the character always has
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

function awarenessHandling(event) {
    var divSibling = event.target.parentNode;
    var id = divSibling.id;

    replaceHeaderWithOptionName(event);

    switch (id) {
        case "awarenessListDiv":
//            resetList("dpsDBOutputDiv", false);
            fillHtmlDbuffList_Common('dpsDBuffListDiv');
            break;
        case "p1awarenessListDiv":
//            resetList("p1DBuffOutputDiv", false);
            fillHtmlDbuffList_Common('p1DBuffListDiv');
            break;
        case "p2awarenessListDiv":
//            resetList("p2DBuffOutputDiv", false);
            fillHtmlDbuffList_Common('p2DBuffListDiv');
            break;
        case "naviawarenessListDiv":
//            resetList("naviDBuffOutputDiv", false);
            fillHtmlDbuffList_Common('naviDBuffListDiv');
            break;
        default:
            break;
    }
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
            outputCharName(event, dropdown, charStatList, 'dpsDBuffListDiv', 'dpsDBOutputDiv', DPS_ROLE);
            document.getElementById("userFilterCharlist").value = '';
//            resetList("dpsDBOutputDiv", false);
//            resetList("dpsDBuffListDiv", true);
            break;
        case "p1charListDiv":
            outputCharName(event, dropdown, charStatList, 'p1DBuffListDiv', 'p1DBuffOutputDiv', SUPPORT_ROLE);
            document.getElementById("userFilterP1Charlist").value = '';
//            resetList("p1DBuffOutputDiv", false);
//            resetList("p1DBuffListDiv", true);
            break;
        case "p2charListDiv":
            outputCharName(event, dropdown, charStatList, 'p2DBuffListDiv', 'p2DBuffOutputDiv', SUPPORT_ROLE);
            document.getElementById("userFilterP2Charlist").value = '';
//            resetList("p2DBuffOutputDiv", false);
//            resetList("p2DBuffListDiv", true);
            break;
        case "naviListDiv":
            outputCharName(event, dropdown, charStatList, 'naviDBuffListDiv', 'naviDBuffOutputDiv', NAVI_ROLE);
            document.getElementById("userFilterNavilist").value = '';
//            resetList("naviDBuffOutputDiv", false);
//            resetList("naviDBuffListDiv", true);
            break;
        default:
            break;
    }

    toggleDropdown(id);
}

function outputCharName(event, dropdown, list, outputListDiv, resetListDiv, role) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].released == 'Y') {
            if (isValidRole(list[i].role, role)) {
                var item = document.createElement("a");
                item.setAttribute('class', 'w3-bar-item w3-button');
                item.innerHTML = list[i].charName;
                item.onclick = function () {
                    replaceCharHeaderWithCharName(this, role);
                    resetList(resetListDiv, false);
                    fillHtmlDbuffList_Common(outputListDiv);;
                };

                dropdown.appendChild(item);
            }
        }
    }
}

function replaceCharHeaderWithCharName(cell, role) {
    var divParent = cell.parentNode.parentNode;
    var charName = cell.innerHTML;

    divParent.children[0].innerHTML = cell.innerHTML;

    if (role == DPS_ROLE) {
        readSkillDatabase();
        outputCharSkillHeader(charName, "skillChoice", skillList);
    }

    var x = cell.parentNode;

    if (x.className.indexOf("w3-show") == -1) {
        x.className += " w3-show";
    }
}

function outputCharSkillHeader(charName, id, list) {
    let header = document.getElementById(id);
    header.innerHTML = '';
    // change only the skillChoice
    for (const item of list) {
        if (item.charName == charName) {
            if (isDpsSkill(item.skillType)) {
                header.innerHTML = item.skillName;
                break;
            }
        }
    }

    if (header.innerHTML == '') {
        header.innerHTML = "S3";
    }
}

function isDpsSkill(skillType) {
    if ((skillType != "") && (skillType != "Passive") && (skillType != "Support")) {
        return true;
    }

    return false;
}

function fillBoss(event) {
    readBossDatabase();

    fillHtmlCommon("bossListDiv", "userFilterBosslist", bossList); 
}

function fillSkill() {
    let charName = document.getElementById("charName").innerHTML;
    let list = [];

    readSkillDatabase();

    for (const skill of skillList) {
        if (charName == skill.charName) {
            if (isDpsSkill(skill.skillInfo[0].skillType)) {
                if (!list.find(item => item.name == skill.skillName)) {
                    let m = [];
                    m.name = skill.skillName;
                    list.push(m);
                }
            }
        }
    }

    if (list.length > 0) {
        fillHtmlCommon("skillListDiv", "", list, false);
    }
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

function filterFunctionCard(event) {
    var child = event.target.parentNode.children[0];

    filterFunction(child.id, event.target.parentNode.id, "a");
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

            data.recStatLvl10 = parseFloat(row[i][j++]);
            data.recStatLvl10m5 = parseFloat(row[i][j++]);
            data.recStatLvl13 = parseFloat(row[i][j++]);
            data.recStatLvl13m5 = parseFloat(row[i][j++]);
            data.scale = row[i][j++];

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

function isElementalAilment(dbuff) {
    if ((dbuff == "SHOCKED") || (dbuff == "WINDSWEEP") || (dbuff == "ELEMENTAL_AILMENT")) {
        return true;
    }

    return false;
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

            data.weapInfo = [];

            for (var dbuffItem = 0; dbuffItem < MAX_NUM_WEAP_DATABASE_EFFECT; dbuffItem++) {
                var dbuff = [];
                dbuff.r0 = parseFloat(row[i][j++]);
                dbuff.r2 = row[i][j++];
                dbuff.dbuff = row[i][j++];
                dbuff.condition = row[i][j++];
                dbuff.conditionType = row[i][j++];
                dbuff.multipliler = row[i][j++];
                if (dbuff.dbuff != "") {
                    data.weapInfo.push(dbuff);
                }
            }

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

            data.cardInfo = [];

            for (var dbuffItem = 0; dbuffItem < MAX_NUM_CARD_DATABASE_EFFECT; dbuffItem++) {
                var dbuff = [];
                dbuff.value = parseFloat(row[i][j++]);
                dbuff.dbuff = row[i][j++];
                dbuff.condition = row[i][j++];
                dbuff.conditionType = row[i][j++];
                if (dbuff.dbuff != "") {
                    data.cardInfo.push(dbuff);
                }
            }

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
            data.skillInfo = [];

            for (var dbuffItem = 0; dbuffItem < MAX_NUM_DATABASE_EFFECT; dbuffItem++) {
                var dbuff = [];
                dbuff.skillType = row[i][j++];    // support or fire or passive
                dbuff.skillBehavior = row[i][j++];    // support or fire or passive
                dbuff.lvl10 = parseFloat(row[i][j++]);
                dbuff.lvl10m5 = parseFloat(row[i][j++]);
                dbuff.lvl13 = parseFloat(row[i][j++]);
                dbuff.lvl13m5 = parseFloat(row[i][j++]);
                dbuff.numHit = parseFloat(row[i][j++]);
                dbuff.dbuff = row[i][j++];
                dbuff.condition = row[i][j++];
                dbuff.conditionType = row[i][j++];
                data.skillInfo.push(dbuff);
            }

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
            data.released = row[i][j++];
            data.source = row[i][j++];
            data.type = row[i][j++];
            data.dbuff = [];

            if (data.released == "N" || data.released == "NA") {
                continue;
            }

            for (var dbuffItem = 0; dbuffItem < MAX_NUM_DATABASE_EFFECT; dbuffItem++) {
                var dbuff = [];
                dbuff.r0 = parseFloat(row[i][j++]);
                dbuff.r1 = parseFloat(row[i][j++]);
                dbuff.r2 = parseFloat(row[i][j++]);
                dbuff.r3 = parseFloat(row[i][j++]);
                dbuff.r4 = parseFloat(row[i][j++]);
                dbuff.r5 = parseFloat(row[i][j++]);
                dbuff.r6 = parseFloat(row[i][j++]);
                dbuff.dbuff = row[i][j++];
                dbuff.condition = row[i][j++];
                dbuff.conditionType = row[i][j++];
                data.dbuff.push(dbuff);
            }

            wonderList.push(data);

            if (data.type == "Weapon") {
                wonderKnifeList.push(data);
            }
            else {
                if (data.type != "Debuff") {
                    htmlWonderDbList.push(data.name);
                }

                if ((data.type == "Passive") && (data.source != "")) {  // don't add general passive since it can be learnt by anyone
                    personaPassive.push(data);
                }
                else if ((data.type != "Highlight") && (data.type != "Debuff") && (data.type != "Weapon Buff")) {
                    personaSkill.push(data);
                }
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

