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

const ATK_BATTLE_CONST = 55;    // for whatever reason, we gain 55 points of atk in battle
const MIN_VARIANCE = 0.95;
const MAX_VARIANCE = 1.05;
const WINDSWEPT_VALUE = 12; // 12%

// Buff/Debuffs label
const EABILITY = Object.freeze({
    E_OTHER: { name: "OTHER", value: "0" },

    // Defense decrease on Enemy
    E_DEF_DECR_PERC: { name: "DEF_DECR_PERC", value: "1" },
    E_DEF_DECR_PERC_AOE: { name: "DEF_DECR_PERC_AOE", value: "2" },

    // EHR Percent (Ailment Accuracy)
    E_SELF_EHR_PERC: { name: "SELF_EHR_PERC", value: "3" },

    // ATK Percent
    E_SELF_ATK_PERC: { name: "SELF_ATK_PERC", value: "4" },
    E_PARTY_ATK_PERC: { name: "PARTY_ATK_PERC", value: "5" },
    E_ALLY_ATK_PERC: { name: "ALLY_ATK_PERC", value: "6" },

    // ATK const buff
    E_SELF_ATK_FLAT: { name: "SELF_ATK_FLAT", value: "7" },
    E_PARTY_ATK_FLAT: { name: "PARTY_ATK_FLAT", value: "8" },
    E_ALLY_ATK_FLAT: { name: "ALLY_ATK_FLAT", value: "9" },

    // Crit Dmg / Crit Mult Percent
    E_SELF_CRIT_MULT_PERC: { name: "SELF_CRIT_MULT_PERC", value: "10" },
    E_ALLIES_CRIT_MULT_PERC: { name: "ALLIES_CRIT_MULT_PERC", value: "11" },
    E_PARTY_CRIT_MULT_PERC: { name: "PARTY_CRIT_MULT_PERC", value: "12" },
    E_ALLY_CRIT_MULT_PERC: { name: "ALLY_CRIT_MULT_PERC", value: "13" },

    // Crit Rate
    E_SELF_CRIT_PERC: { name: "SELF_CRIT_PERC", value: "14" },
    E_PARTY_CRIT_PERC: { name: "PARTY_CRIT_PERC", value: "15" },
    E_ALLY_CRIT_PERC: { name: "ALLY_CRIT_PERC", value: "16" },

    // DMG Bonus or Dmg Mult
    E_SELF_DMG_PERC: { name: "SELF_DMG_PERC", value: "17" },    
    E_PARTY_DMG_PERC: { name: "PARTY_DMG_PERC", value: "18" },
    E_ALLY_DMG_PERC: { name: "ALLY_DMG_PERC", value: "19" },

    // Pierce Rate
    E_SELF_PIERCE_PERC: { name: "SELF_PIERCE_PERC", value: "20" },
    E_PARTY_PIERCE_PERC: { name: "PARTY_PIERCE_PERC", value: "21" },
    E_ALLY_PIERCE_PERC: { name: "ALLY_PIERCE_PERC", value: "22" },

    // Damage Skill
    E_DMG_SKILL_AOE: { name: "DMG_SKILL_AOE", value: "23" },
    E_DMG_SKILL_SINGLE: { name: "DMG_SKILL_SINGLE", value: "24" },

    // Conditional buff
    E_SELF_HL_BUFF_REQ: { name: "SELF_HL_BUFF_REQ", value: "25" },  // Required to have buff from using HL first
    E_SEES_ALLY_REQ: { name: "SEES_ALLY_REQ", value: "26" },     // Required SEES Ally to activate
});

// ----------------- Awareness Cal --------------------------------------------//

// R1, R3, R5 increase or R2, R4, R6 increase
function calcWeaponBasedOnReforge(r0, r1, r2, reforgeLevel) {
    var delta = r0;
    var r3 = 0, r4 = 0, r5 = 0, r6 = 0;

    if (r1 != 0) {
        // r1 increase, then r2 = r1, r4 = r3, 
        delta = r1 - r0;
        r2 = r1;
        r3 = r1 + delta;
        r4 = r3;
        r5 = r3 + delta;
        r6 = r5;        
    }
    else if (r2 != 0) {
        delta = r2 - r0;
        r1 = r0;
        r2 = r0 + delta;
        r3 = r2;
        r4 = r2 + delta;
        r5 = r4;
        r6 = r4 + delta;
    }
    else {
        // shouldn't happened. should have data, but since it doesn't, just return r0?
    }

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

//    return [r0.toFixed(2), r1.toFixed(2), r2.toFixed(2), r3.toFixed(2), r4.toFixed(2), r5.toFixed(2), r6.toFixed(2)];
}

// ----------------- Damage Calculation Support -------------------------------//
/*function calculateDefenseReductionPerc() {
    // Card
    // Single   Control + Departure     23%         2 turns
    // Single   Labor + Resolve         10%         2 turns

    // Wonder
    // AOE      Starry Compass          22%
    // AOE      Curse of the phantom    25%         3 turns
    // AOE/Single   Arc knife           36%         2 turns, 4 stacks, element alignment
    // AOE/Single   Eye of Obsequies    20%         2 turns, 2 stacks, when apply debuffed

    // Persona
    // Single   Rakunda                 38.8%       3 turns
    // AOE      Melodic infiltration    32%         3 turns, payment event
    // AOE      Marakunda               27.1%       3 turns
    // Single/AOE   Vishnu              48%         2 turns, windsweep success
    // Single   Janosik                 41.6%       2 turns, Marked
    // Single   Chernobog-Unique        10%         2 turns
    // AOE      Nian-Unique             10%         2 turns
    // AOE      Shiva-Unique            45%         1 turn, 2 turns CD
    // Single   Sraosha-Unique          25%         1 turn, blessing

    // Mitsuru
    // Single   Skill 1, A6             109.06%
    // Single   skill 2                 45.45%

    // Blitz
    // AOE      Skill 1                 56.8%       2 turns, skill 2 overlaop not allowed
    // AOE      Skill 2                 56.8%       1 turn, skill 1 overlap not allowed
    // AOE      HL                      34.1%       Down enemy
    // AOE      A0                      50%

    // Marian-Summer
    // AOE      A2                      25%         3 turns, skill 1

    // Berry
    // Single   A1                      45%         3% per stack

    // Matoi
    // AOE          skill 1             45%         3 turns
    // AOE          skill 3             42.6%       2 turns, skill 3 enhance overlap not allowed
    // AOE          skill 3 enhanced    51.1%       2 turns
    // AOE          Exclusive weapon    44.3%       2 turns R5/R6

    // Navi
    // AOE        Skill 1                   93.1%   3 turns
    // AOE        Skill 1                   46.55%  3 turns

    // Crow
    // AOE         Skill 2                  29.5%   2 turn. A1 4 turns

    // Mont-Swan
    // AOE         A2                       40%     3 turns Spring

    // Moko-Seaside
    // AOE         A1                       45%     15% per stack, 3 stacks, follow up
    // AOE         Exclusive weapon         12%     3 turns

    // Howler
    // AOE          Exclusive weapon        31.7%   2 turns, R5/R6
    // Single       Exclusive weapon        63.3%   2 turns, R5/R6
    // AOE          A0                      18%     2 turns, A6 is 3 turns
    // AOE          Skill 1                 58.7%   2 turns, A6 3 turns
    // AOE          Skill 1                 30.7%   2 turns, A6 3 turns
    // Single       Skill 2                 78%     2 turns, A6 3 turns

    // Vino
    // Single       Exclusive weapon        63%     R5/R6
    // Single       Skill 1                 38.8%   2 turns

    // Wind
    // AOE          Skill 1                 45.5%   2 turns

    // Rin
    // AOE          Skill 1                 58.6%   2 turns

    // Soy
    // Single/AOE   Exclusive weapon        57%     R5/R6 1 turn, triggered when attacked
    // Single       skill 2                 62.4%   Desperado
    // Single/AOE   Gun Shot                35%     3 turns, 10%, 42 bullets, 24 refill
}

function calculatePiercePerc() {
    // Card
    // AOE      Labor + Hope:            5%          1 turn
    // Self     Freedom + Success:      16%          2 stack follow-up

    // Ange
    // AOE      Skill 3:                 19.6%       2 turns
    // AOE      Passive:                 12%         Stack * 1%

    // Yukari
    // single   A1                       20%         2 turns

    // Turbo
    // aoe      skill 3:                 5.5%        2 turns
    // single   skill 3:                 11.4%       1 turn addional turn main target
    // aoe      A0                       15%
    // single   A1                       10%         1 turn addional turn main target

    // Luce
    // Single   Skill3                   13.7%       2 turn windswept state

    // Marian
    // AOE      A1                       20%         overheal

    // Cherish
    // AOE      A1                       20%

    // Vino
    // AOE      A6                       8%          radiation + element alignment 3

    // Berry
    // Self     mindscape                7.5%

    // Akihiko
    // Self     A0                       12%         fortitdue 4%
    // Self     A6                       16%         fortitdue 4% do not stack with A0

    // Makoto Yuki
    // Self     Skill 3                  13.6%       moon 4 stacks
    // Self     A0                       12%         moon
    // self     A1, skill 2              10%         2 turns
    // self     mindscape                7.5%

    // Messa
    // Self     passive                  21%         Ripper mode
    // Self     mindscape                7.5%
    // Self     weapon                   47.5%       R5&6 Rending dmg

    // Fox
    // Self     passive                  20%         1 turn after using skill 3
    // Self     A6                       30%         counter attack

    // Queen
    // Self     A2                       30%         when crash out is active, 6% for each element ailment

    // Noir
    // Self     A6                       12%

    // Mont-Swan
    // Self     A6                       20%         when winter night doman ends, every frost shard increase by 5%, max 5 stack of shard

    // Skull
    // Self     A2                       35%         when dealing critical dmg
}
*/

// × ⓒ 1 - {Enemy Defense Value × [(100% + Additional Defense Coefficient) × (100% - Pierce) - Defense Reduction] × (100% - Windswept 12%)}
// ÷ {Enemy Defense Value ×[(100 % + Additional Defense Coefficient) × (100 % - Pierce) - Defense Reduction] × (100 % - Windswept 12 %) + 1400 }

function calculateEnemyDefenseFinal(enemyDefValue, additionalDefCoef, windSweptBool, pierceRate, defenseReduction) {

    if (windSweptBool) {
        windSwept = WINDSWEPT_VALUE;
    }
    else {
        windSwept = 0;
    }

    var defenseCoefficient = (100 + additionalDefCoef) * (100 - pierceRate)/100 - defenseReduction;        
    var value = (enemyDefValue * defenseCoefficient/100 * (100 - windSwept)/100);

    return (1 - value / (value + 1400));
}

function calculateDmgBonusFinal(dmgMult) {
    return (100 + dmgMult)/100;// + elemDmgInc + DmgTakeInc);
}

// Critical damage multiplies damage by the ‘Critical DMG(Mult)’ amount when critical hits occur.
// The base critical rate is 5 %, and the base Critical DMG(Mult) is 150 %, meaning there’s a 5 % chance to deal 1.5x damage.
// Notably, Dionysus can increase critical rate by 15.7 % through Rebellion, and increase Critical DMG(Mult) by 30 % through its passive.
// In boss sections, while criticals don’t occur due to the Stable Domain, damage is increased based on expected value calculations.
// Critical Rate × (Critical DMG(Mult) - 100 %) :: Max Crit Rate is 100%
// If you increase critical rate by 10%, increasing Critical DMG(Mult) by twice that amount (20%) is most efficient.
function calculateCritStableDomain(critRate, critMult) {
    if (critRate > 100) {
        critRate = 100;
    }

    return (100 + critRate * (critMult - 100)/100)/100;
}

function calculateAtkFinal(base, flat, percent) {
    return (base * (100 + percent)/100 + flat + ATK_BATTLE_CONST);
}

/*
Dmg formula from: https://lufel.net/article/damage-calc/?lang=en

Final Dmg = ⓐ Attack Power Calculation × ⓑ Damage Bonus Calculation × ⓒ Enemy Defense Calculation × ⓓ Critical Calculation × ⓔ Skill Coefficient
× ⓕ Weakness Coefficient × ⓖ Final Damage Bonus × ⓗ Other Coefficients × ⓘ Random Range Coefficient

ⓐ {(Character Attack Value + Weapon Attack Value) × Attack % + Attack Constant}

× ⓑ {100% + Attack Mult. + Elemental Damage Bonus + Increased Damage Taken by Enemy}

× ⓒ 1 - {Enemy Defense Value × [(100% + Additional Defense Coefficient) × (100% - Pierce) - Defense Reduction] × (100% - Windswept 12%)} 
÷ {Enemy Defense Value × [(100% + Additional Defense Coefficient) × (100% - Pierce) - Defense Reduction] × (100% - Windswept 12%) + 1400}

× ⓓ {Critical DMG(Mult) (when Critical occurs) or Stable Domain}

× ⓔ Skill Coefficient 

× ⓕ Weakness Coefficient (Resistance 50% / Normal 100% / Weakness 120%)

× ⓖ Final Damage Bonus 

× ⓗ Other Coefficients 

× ⓘ Random Range Coefficient (0.95~1.05)

ⓖ Final Damage Bonus / ⓗ Other Coefficients
In certain gimmicks or boss battles, there are forms where final damage increases or decreases based on conditions. These are calculated separately.

*/
function calculateSkillDamage(atkFinal, dmgMultFinal, enemyDefFinal, critMultFinal, skillPerc, weakness, finalDmgBonus, others) {
    var minSkillDamage;
    var maxSkillDamage;

    var skillDmg = atkFinal * dmgMultFinal * enemyDefFinal * critMultFinal * skillPerc * weakness * finalDmgBonus * others;
    minSkillDamage = Math.round(skillDmg * MIN_VARIANCE);
    maxSkillDamage = Math.round(skillDmg * MAX_VARIANCE);
    var averageSkillDamage = Math.floor((minSkillDamage + maxSkillDamage) / 2);

    return [minSkillDamage, maxSkillDamage, averageSkillDamage];
}
