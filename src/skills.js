/**
 * skills.js
 *
 * Dynamically loads custom Skills from the Anthropic API workspace.
 *
 * No Skill IDs are hardcoded in the backend.
 *
 * Flow:
 * Anthropic Skills API
 *      ↓
 * fetch custom skills
 *      ↓
 * cache for 5 minutes
 *      ↓
 * attach Skills to Claude requests
 */


const ANTHROPIC_SKILLS_URL =
  "https://api.anthropic.com/v1/skills";


const SKILLS_BETA =
  "skills-2025-10-02";


/**
 * Cache duration:
 * 5 minutes
 */
const CACHE_DURATION_MS =
  5 * 60 * 1000;


/**
 * Messages API currently allows
 * up to 8 Skills in a request.
 */
const MAX_SKILLS_PER_REQUEST = 8;


/**
 * In-memory cache.
 */
let skillCache = {
  skills: [],
  loadedAt: 0,
};


/**
 * ------------------------------------------------
 * GET AVAILABLE CUSTOM SKILLS
 * ------------------------------------------------
 */
export async function getAvailableSkills({
  forceRefresh = false,
} = {}) {

  const now =
    Date.now();


  const cacheIsFresh =
    skillCache.loadedAt > 0 &&
    now - skillCache.loadedAt <
      CACHE_DURATION_MS;


  if (
    !forceRefresh &&
    cacheIsFresh
  ) {

    return skillCache.skills;
  }


  console.log(
    "Refreshing Anthropic Skill catalog..."
  );


  const skills =
    await fetchAllCustomSkills();


  skillCache = {
    skills,
    loadedAt: now,
  };


  console.log(
    `Skill catalog refreshed. Found ${skills.length} custom Skill(s).`
  );


  for (const skill of skills) {

    console.log(
      `Skill: ${skill.displayTitle} (${skill.id})`
    );
  }


  return skills;
}


/**
 * ------------------------------------------------
 * FETCH ALL CUSTOM SKILLS
 * ------------------------------------------------
 *
 * Supports pagination.
 */
async function fetchAllCustomSkills() {

  const allSkills = [];

  let nextPage = null;


  do {

    const url =
      new URL(
        ANTHROPIC_SKILLS_URL
      );


    url.searchParams.set(
      "source",
      "custom"
    );


    url.searchParams.set(
      "limit",
      "100"
    );


    if (nextPage) {

      url.searchParams.set(
        "page",
        nextPage
      );
    }


    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",

          headers: {
            "x-api-key":
              process.env
                .ANTHROPIC_API_KEY,

            "anthropic-version":
              "2023-06-01",

            "anthropic-beta":
              SKILLS_BETA,
          },
        }
      );


    if (!response.ok) {

      const errorText =
        await response.text();


      throw new Error(
        `Unable to list Anthropic Skills. HTTP ${response.status}: ${errorText}`
      );
    }


    const result =
      await response.json();


    const pageSkills =
      Array.isArray(result.data)
        ? result.data
        : [];


    for (
      const skill of pageSkills
    ) {

      allSkills.push(
        normalizeSkill(skill)
      );
    }


    nextPage =
      result.next_page ||
      null;


  } while (nextPage);


  return allSkills;
}


/**
 * ------------------------------------------------
 * NORMALIZE SKILL OBJECT
 * ------------------------------------------------
 */
function normalizeSkill(skill) {

  return {

    id:
      skill.id,

    source:
      skill.source ||
      "custom",

    displayTitle:
      skill.display_title ||
      skill.name ||
      skill.id,

    latestVersion:
      skill.latest_version ||
      "latest",

    createdAt:
      skill.created_at ||
      null,

    updatedAt:
      skill.updated_at ||
      null,
  };
}


/**
 * ------------------------------------------------
 * GET SKILLS FOR CLAUDE CONTAINER
 * ------------------------------------------------
 *
 * V1 strategy:
 * Attach available custom Skills.
 *
 * Claude decides which Skill is relevant.
 */
export async function getSkillsForClaude() {

  const availableSkills =
    await getAvailableSkills();


  const selectedSkills =
    availableSkills.slice(
      0,
      MAX_SKILLS_PER_REQUEST
    );


  return selectedSkills.map(
    (skill) => ({
      type: "custom",

      skill_id:
        skill.id,

      version:
        "latest",
    })
  );
}


/**
 * ------------------------------------------------
 * FORCE CACHE REFRESH
 * ------------------------------------------------
 */
export async function refreshSkillCache() {

  return getAvailableSkills({
    forceRefresh: true,
  });
}


/**
 * ------------------------------------------------
 * CACHE STATUS
 * ------------------------------------------------
 */
export function getSkillCacheStatus() {

  return {

    count:
      skillCache.skills.length,

    loadedAt:
      skillCache.loadedAt
        ? new Date(
            skillCache.loadedAt
          ).toISOString()
        : null,

    skills:
      skillCache.skills.map(
        (skill) => ({
          id:
            skill.id,

          name:
            skill.displayTitle,

          version:
            skill.latestVersion,
        })
      ),
  };
}