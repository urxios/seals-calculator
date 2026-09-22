const PERCENT_ATTRIBUTES = new Set(["EV", "CT", "BL"]);

const thousandFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const goldFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const THEMES = window.AppThemes.THEMES;
const THEME_SEQUENCE = window.AppThemes.THEME_SEQUENCE;

const CALCULATOR_STRATEGY_LABELS = {
    auto: "Menor custo exato",
    ultra: "Menor custo exato",
    seals: "Menos selos",
    openers: "Menos openers",
};

const DEFAULT_LEVEL_THRESHOLDS = {
    Normal: 1,
    Bronze: 50,
    Prata: 200,
    Ouro: 500,
    Platina: 1000,
    Master: 3000,
};

const DEFAULT_LEVEL_PERCENTAGES = {
    Normal: 10,
    Bronze: 20,
    Prata: 40,
    Ouro: 60,
    Platina: 80,
    Master: 100,
};

const FLOATING_PANEL_MEDIA_QUERY = "(min-width: 1181px)";
const FLOATING_PANEL_TOP_OFFSET = 104;
const TEMPLATE_PAGE_SIZE = 24;
const ACCOUNT_SEAL_PAGE_SIZE = 24;
const SEAL_CARD_VIEW_STORAGE_KEY = "dmowikiv2.seals.card-view";
const HIDE_MAXED_SEALS_STORAGE_KEY = "dmowikiv2.seals.hide-maxed";
const SEALS_API_CACHE_PREFIX = "dmowikiv2.seals.api.";
const SEALS_API_CACHE_MAX_AGE = 60 * 1000;
const SEALS_PERF_DEBUG = new URLSearchParams(window.location.search).has("perf");
const SEALS_PERF = (() => {
    if (!window.performance?.mark || !window.performance?.measure) {
        return { mark() {}, measure() {} };
    }
    const prefixed = (name) => `seals:${name}`;
    return {
        mark(name) {
            try {
                window.performance.mark(prefixed(name));
            } catch (_error) {
            }
        },
        measure(name, start, end) {
            try {
                window.performance.measure(prefixed(name), prefixed(start), prefixed(end));
                if (SEALS_PERF_DEBUG) {
                    const entries = window.performance.getEntriesByName(prefixed(name));
                    const entry = entries[entries.length - 1];
                    if (entry) {
                        console.debug("[seals:perf]", name, `${entry.duration.toFixed(1)}ms`);
                    }
                }
            } catch (_error) {
            }
        },
    };
})();
const APP_CONFIG = window.APP_CONFIG || {};
const INITIAL_AUTH = APP_CONFIG.auth || {};

SEALS_PERF.mark("script-start");

function normalizeAttributeKey(attribute) {
    return String(attribute || "").trim().toUpperCase();
}

function isPercentAttribute(attribute) {
    return PERCENT_ATTRIBUTES.has(normalizeAttributeKey(attribute));
}

const state = {
    tab: "calculator",
    accounts: (window.APP_CONFIG && window.APP_CONFIG.accounts) || [],
    accountsLoaded: false,
    account: (window.APP_CONFIG && window.APP_CONFIG.defaultAccount) || "",
    adminEmail: (window.APP_CONFIG && (window.APP_CONFIG.adminEmail || "").toLowerCase()) || "kaickamiyadigital@gmail.com",
    emailEnabled: !!(window.APP_CONFIG && window.APP_CONFIG.emailEnabled),
    isAdmin: !!(window.APP_CONFIG && window.APP_CONFIG.is_admin),
    adminUsers: [],
    templates: [],
    templateCatalogComplete: false,
    templatePagination: null,
    templateLoadingAll: null,
    templateSearch: "",
    templateMode: "create",
    templateEditingId: null,
    templatePatternId: null,
    draggingTemplateId: null,
    draggingAccount: null,
    blockedTemplates: [],
    mySeals: [],
    personalSealPrices: {},
    accountSearch: "",
    attributeFilter: "TODOS",
    authEmail: INITIAL_AUTH.email || "",
    displayName: INITIAL_AUTH.displayName || "",
    authLogged: !!INITIAL_AUTH.authenticated,
    avatarUrl: INITIAL_AUTH.avatarUrl || "",
    theme: INITIAL_AUTH.theme || "light",
    servers: (window.APP_CONFIG && window.APP_CONFIG.servers) || [],
    serverKey: (window.APP_CONFIG && window.APP_CONFIG.defaultServer) || "",
    impersonating: false,
    goldUnits: (window.APP_CONFIG && window.APP_CONFIG.goldUnits) || [],
    currencyBasePath: (window.APP_CONFIG && window.APP_CONFIG.currencyBasePath) || "",
    defaultGoldUnit: (window.APP_CONFIG && window.APP_CONFIG.defaultGoldUnit) || "M",
    goldModalTemplate: null,
    goldModalServer: null,
    goldModalAccountSeal: null,
    goldModalSourceUserId: null,
    goldModalSourceAccounts: [],
    levels: (window.APP_CONFIG && window.APP_CONFIG.sealLevels) || [],
    attributes: (window.APP_CONFIG && window.APP_CONFIG.sealAttributes) || [],
    defaults: (window.APP_CONFIG && window.APP_CONFIG.sealDefaults) || {},
    sealDefaultsDraft: null,
    sealDefaultsDraftPatternId: null,
    openersOwned: 0,
    openerPrice: "",
    accountSealMode: "create",
    accountSealEditingId: null,
    calculatorAttribute:
        (window.APP_CONFIG &&
            window.APP_CONFIG.sealAttributes &&
            window.APP_CONFIG.sealAttributes[0]) ||
        "AT",
    calculatorStrategy: "auto",
    calculatorBudgetMode: false,
    calculatorBudget: "",
    calculatorTarget: "",
    calculatorPlan: null,
    templatePage: 1,
    accountPage: 1,
    sealOcrRows: [],
    sealOcrCaptureSource: null,
    sealOcrCaptureSelection: null,
    sealOcrCaptureDrag: null,
    sealOcrEventsBound: false,
    templatePaginationEnabled: !(
        window.APP_CONFIG &&
        window.APP_CONFIG.auth &&
        window.APP_CONFIG.auth.sealTemplatePaginationEnabled === false
    ),
    simpleSealCards: false,
    hideMaxedSeals: false,
};

let templateSearchTimer = null;
let initialSealPayloadConsumed = false;

const elements = {
    tabs: document.querySelectorAll(".tab-btn"),
    templateList: document.getElementById("templateList"),
    templatePager: document.getElementById("templatePager"),
    templateStats: document.getElementById("templateStats"),
    templateSearchInput: document.getElementById("templateSearchInput"),
    accountSearchInput: document.getElementById("accountSearchInput"),
    accountSealList: document.getElementById("accountSealList"),
    accountPager: document.getElementById("accountPager"),
    mySealCountBadge: document.getElementById("mySealCountBadge"),
    accountTotalGoldText: document.getElementById("accountTotalGoldText"),
    accountTotalGoldIcon: document.getElementById("accountTotalGoldIcon"),
    attributeFilter: document.getElementById("attributeFilter"),
    attributeStats: document.getElementById("attributeStats"),
    attributeStatsPanels: document.querySelectorAll("[data-attribute-stats]"),
    attributeTrackerDock: document.getElementById("attributeTrackerDock"),
    accountTabs: document.getElementById("accountTabs"),
    mySealsTabCount: document.getElementById("mySealsTabCount"),
    sealModal: document.getElementById("sealModal"),
    sealModalTitle: document.getElementById("sealModalTitle"),
    sealPatternHint: document.getElementById("sealPatternHint"),
    sealForm: document.getElementById("sealForm"),
    sealDefaultsModal: document.getElementById("sealDefaultsModal"),
    sealDefaultsForm: document.getElementById("sealDefaultsForm"),
    openSealDefaultsModalBtn: document.getElementById("openSealDefaultsModal"),
    sealDefaultsPatternSelect: document.getElementById("sealDefaultsPatternSelect"),
    sealDefaultsPatternNameInput: document.getElementById("sealDefaultsPatternName"),
    createSealDefaultPatternBtn: document.getElementById("createSealDefaultPatternBtn"),
    deleteSealDefaultPatternBtn: document.getElementById("deleteSealDefaultPatternBtn"),
    resetSealDefaultsBtn: document.getElementById("resetSealDefaultsBtn"),
    sealNameInput: document.getElementById("sealNameInput"),
    sealAttributeSelect: document.getElementById("sealAttributeSelect"),
    sealBaseValueInput: document.getElementById("sealBaseValueInput"),
    accountSealModal: document.getElementById("accountSealModal"),
    accountSealForm: document.getElementById("accountSealForm"),
    accountSealAccountInput: document.getElementById("accountSealAccountInput"),
    accountSealTemplateSelect: document.getElementById("accountSealTemplateSelect"),
    accountSealQuantityInput: document.getElementById("accountSealQuantityInput"),
    accountSealUnitCostInput: document.getElementById("accountSealUnitCostInput"),
    accountSealUnitCostHint: document.getElementById("accountSealUnitCostHint"),
    loader: document.getElementById("globalLoader"),
    toastContainer: document.getElementById("toastContainer"),
    openLoginPanel: document.getElementById("openLoginPanel"),
    openSealModalBtn: document.getElementById("openSealModal"),
    openAccountSealModalBtn: document.getElementById("openAccountSealModal"),
    openImportSealsModalBtn: document.getElementById("openImportSealsModal"),
    importSealsModal: document.getElementById("importSealsModal"),
    importSealsForm: document.getElementById("importSealsForm"),
    importSealsAttributeSelect: document.getElementById("importSealsAttributeSelect"),
    importSealsServerSelect: document.getElementById("importSealsServerSelect"),
    importSealsFileInput: document.getElementById("importSealsFileInput"),
    openSealOcrModalBtn: document.getElementById("openSealOcrModal"),
    sealOcrModalTemplate: document.getElementById("sealOcrModalTemplate"),
    sealOcrModal: document.getElementById("sealOcrModal"),
    sealOcrForm: document.getElementById("sealOcrForm"),
    sealOcrFileInput: document.getElementById("sealOcrFileInput"),
    sealOcrCaptureBtn: document.getElementById("sealOcrCaptureBtn"),
    sealOcrClearCaptureBtn: document.getElementById("sealOcrClearCaptureBtn"),
    sealOcrCaptureArea: document.getElementById("sealOcrCaptureArea"),
    sealOcrCaptureWrap: document.getElementById("sealOcrCaptureWrap"),
    sealOcrCaptureCanvas: document.getElementById("sealOcrCaptureCanvas"),
    sealOcrCaptureSelection: document.getElementById("sealOcrCaptureSelection"),
    sealOcrResults: document.getElementById("sealOcrResults"),
    openAccountManagerBtn: document.getElementById("openAccountManager"),
    accountManagerModal: document.getElementById("accountManagerModal"),
    renameAccountForm: document.getElementById("renameAccountForm"),
    deleteAccountForm: document.getElementById("deleteAccountForm"),
    renameAccountSelect: document.getElementById("renameAccountSelect"),
    renameAccountInput: document.getElementById("renameAccountInput"),
    deleteAccountSelect: document.getElementById("deleteAccountSelect"),
    accountOptionsDatalist: document.getElementById("sealAccountOptions"),
    authStatus: document.getElementById("authStatus"),
    authActionBtn: document.getElementById("authActionBtn"),
    loginForm: document.getElementById("userLoginForm"),
    registerForm: document.getElementById("userRegisterForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginRemember: document.getElementById("loginRemember"),
    registerEmail: document.getElementById("registerEmail"),
    registerPassword: document.getElementById("registerPassword"),
    registerRemember: document.getElementById("registerRemember"),
    switchToRegister: document.getElementById("switchToRegister"),
    switchToLogin: document.getElementById("switchToLogin"),
    openForgotPasswordBtn: document.getElementById("openForgotPasswordBtn"),
    forgotPasswordModal: document.getElementById("forgotPasswordModal"),
    forgotPasswordForm: document.getElementById("forgotPasswordForm"),
    forgotPasswordEmailInput: document.getElementById("forgotPasswordEmailInput"),
    openContactBtn: document.getElementById("openContactBtn"),
    openContactBtnRegister: document.getElementById("openContactBtnRegister"),
    contactModal: document.getElementById("contactModal"),
    contactForm: document.getElementById("contactForm"),
    contactNameInput: document.getElementById("contactNameInput"),
    contactEmailInput: document.getElementById("contactEmailInput"),
    contactSubjectInput: document.getElementById("contactSubjectInput"),
    contactMessageInput: document.getElementById("contactMessageInput"),
    userProfileCount: document.getElementById("userProfileCount"),
    userAvatarImg: document.getElementById("userAvatarImg"),
    userAvatarTrigger: document.getElementById("userAvatarTrigger"),
    themeToggle: document.getElementById("themeToggle"),
    openProfileBtn: document.getElementById("openProfileBtn"),
    profileModal: document.getElementById("profileModal"),
    profileForm: document.getElementById("profileForm"),
    profileAvatarInput: document.getElementById("profileAvatarInput"),
    userPanelToggle: document.getElementById("userPanelToggle"),
    userPanel: document.getElementById("userPanel"),
    userPanelLogged: document.getElementById("userPanelLogged"),
    adminPanel: document.getElementById("adminPanel"),
    adminPanelToggle: document.getElementById("adminPanelToggle"),
    adminBlock: document.getElementById("adminBlock"),
    adminEmailInput: document.getElementById("adminEmailInput"),
    addAdminBtn: document.getElementById("addAdminBtn"),
    listUsersBtn: document.getElementById("listUsersBtn"),
    stopImpersonateBtn: document.getElementById("stopImpersonateBtn"),
    downloadDbBtn: document.getElementById("downloadDbBtn"),
    importDbBtn: document.getElementById("importDbBtn"),
    importLegacyExcelsBtn: document.getElementById("importLegacyExcelsBtn"),
    importDbInput: document.getElementById("importDbInput"),
    serverKeyInput: document.getElementById("serverKeyInput"),
    serverLabelInput: document.getElementById("serverLabelInput"),
    addServerBtn: document.getElementById("addServerBtn"),
    serverAdminList: document.getElementById("serverAdminList"),
    openAdminEmailNoticeBtn: document.getElementById("openAdminEmailNoticeBtn"),
    adminEmailNoticeModal: document.getElementById("adminEmailNoticeModal"),
    adminEmailNoticeForm: document.getElementById("adminEmailNoticeForm"),
    adminEmailNoticeToInput: document.getElementById("adminEmailNoticeToInput"),
    adminEmailNoticeSubjectInput: document.getElementById("adminEmailNoticeSubjectInput"),
    adminEmailNoticeMessageInput: document.getElementById("adminEmailNoticeMessageInput"),
    adminEmailNoticeActionUrlInput: document.getElementById("adminEmailNoticeActionUrlInput"),
    adminEmailNoticeActionLabelInput: document.getElementById("adminEmailNoticeActionLabelInput"),
    userListModal: document.getElementById("userListModal"),
    userListBody: document.getElementById("userListBody"),
    exportMySealsPdfBtn: document.getElementById("exportMySealsPdf"),
    goldModal: document.getElementById("goldModal"),
    goldModalForm: document.getElementById("goldModalForm"),
    goldModalTitle: document.getElementById("goldModalTitle"),
    goldModalCostInput: document.getElementById("goldModalCostInput"),
    goldModalCostHint: document.getElementById("goldModalCostHint"),
    goldModalAdminSource: document.getElementById("goldModalAdminSource"),
    goldModalSourceUserInput: document.getElementById("goldModalSourceUserInput"),
    goldModalSourceUserOptions: document.getElementById("goldModalSourceUserOptions"),
    goldModalSourceAccountInput: document.getElementById("goldModalSourceAccountInput"),
    goldModalSourceAccountOptions: document.getElementById("goldModalSourceAccountOptions"),
    goldModalSyncBtn: document.getElementById("goldModalSyncBtn"),
    goldModalSyncAllBtn: document.getElementById("goldModalSyncAllBtn"),
    templateAdminActions: document.getElementById("templateAdminActions"),
    templateSimpleViewToggle: document.getElementById("toggleSimpleCardsBtn"),
    accountSimpleViewToggle: document.getElementById("toggleSimpleCardsAccountBtn"),
    templateHideMaxedToggle: document.getElementById("toggleHideMaxedSealsBtn"),
    accountHideMaxedToggle: document.getElementById("toggleHideMaxedSealsAccountBtn"),
    calculatorForm: document.getElementById("calculatorForm"),
    calculatorAttributeSelect: document.getElementById("calculatorAttributeSelect"),
    calculatorStrategySelect: document.getElementById("calculatorStrategySelect"),
    calculatorBudgetToggle: document.getElementById("calculatorBudgetToggle"),
    calculatorBudgetInput: document.getElementById("calculatorBudgetInput"),
    calculatorBudgetHint: document.getElementById("calculatorBudgetHint"),
    calculatorTargetInput: document.getElementById("calculatorTargetInput"),
    calculatorOpenersInput: document.getElementById("calculatorOpenersInput"),
    calculatorOpenerPriceInput: document.getElementById("calculatorOpenerPriceInput"),
    calculatorOpenerPriceHint: document.getElementById("calculatorOpenerPriceHint"),
    calculatorResults: document.getElementById("calculatorResults"),
    calculatorAccountLabel: document.getElementById("calculatorAccountLabel"),
    calculatorCurrentStat: document.getElementById("calculatorCurrentStat"),
    calculatorOpenersTotal: document.getElementById("calculatorOpenersTotal"),
    serverTabs: document.getElementById("serverTabs"),
};

let scrollDockSyncFrame = 0;

function isWideDesktopLayout() {
    return window.matchMedia(FLOATING_PANEL_MEDIA_QUERY).matches;
}

function hasAdminDesktopDocking() {
    return false;
}

function shouldDockFloatingPanels() {
    return false;
}

function syncAdminPanelToggle(isVisible) {
    if (!elements.adminPanelToggle) {
        return;
    }
    elements.adminPanelToggle.classList.toggle("is-visible", !!isVisible);
    const expanded = isWideDesktopLayout()
        ? !!elements.adminPanel && !elements.adminPanel.classList.contains("is-collapsed")
        : !!elements.adminPanel && elements.adminPanel.classList.contains("is-open");
    elements.adminPanelToggle.setAttribute("aria-expanded", String(expanded));
    elements.adminPanelToggle.setAttribute(
        "aria-label",
        expanded ? "Ocultar painel admin" : "Expandir painel admin",
    );
    elements.adminPanelToggle.textContent = expanded ? "×" : "☰";
}

function syncFloatingPanels() {
    if (elements.attributeTrackerDock) {
        elements.attributeTrackerDock.classList.remove("is-visible");
        elements.attributeTrackerDock.setAttribute("aria-hidden", "true");
    }
    if (elements.adminPanel) {
        elements.adminPanel.classList.remove("is-collapsed");
    }
    syncAdminPanelToggle(false);
}

function scheduleFloatingPanelsSync() {
    if (scrollDockSyncFrame) {
        window.cancelAnimationFrame(scrollDockSyncFrame);
        scrollDockSyncFrame = 0;
    }
    syncFloatingPanels();
}

function createSealPatternId() {
    return `seal-pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSingleSealPattern(pattern, index = 0) {
    const normalized = {
        id: String(pattern && pattern.id ? pattern.id : `seal-pattern-${index + 1}`),
        name: String(pattern && pattern.name ? pattern.name : `Padrao ${index + 1}`),
        thresholds: { ...DEFAULT_LEVEL_THRESHOLDS },
        percentages: { ...DEFAULT_LEVEL_PERCENTAGES },
    };
    const rawThresholds = pattern && typeof pattern.thresholds === "object" ? pattern.thresholds : {};
    const rawPercentages = pattern && typeof pattern.percentages === "object" ? pattern.percentages : {};
    state.levels.forEach((level) => {
        if (rawThresholds[level] !== undefined) {
            normalized.thresholds[level] = parseInteger(rawThresholds[level]) ?? normalized.thresholds[level];
        }
        if (rawPercentages[level] !== undefined) {
            normalized.percentages[level] = parseNumber(rawPercentages[level]) ?? normalized.percentages[level];
        }
    });
    return normalized;
}

function normalizeSealDefaultsConfig(defaults) {
    const fallbackPattern = normalizeSingleSealPattern(
        {
            id: "pattern-3000",
            name: "Padrao 3000",
            thresholds: DEFAULT_LEVEL_THRESHOLDS,
            percentages: DEFAULT_LEVEL_PERCENTAGES,
        },
        0,
    );
    if (!defaults || typeof defaults !== "object") {
        return {
            activePatternId: fallbackPattern.id,
            patterns: [fallbackPattern],
        };
    }

    if ((defaults.thresholds || defaults.percentages) && !Array.isArray(defaults.patterns)) {
        const legacyPattern = normalizeSingleSealPattern(
            {
                id: fallbackPattern.id,
                name: fallbackPattern.name,
                thresholds: defaults.thresholds,
                percentages: defaults.percentages,
            },
            0,
        );
        return {
            activePatternId: legacyPattern.id,
            patterns: [legacyPattern],
        };
    }

    const rawPatterns = Array.isArray(defaults.patterns) && defaults.patterns.length ? defaults.patterns : [fallbackPattern];
    const seenIds = new Set();
    const patterns = rawPatterns.map((pattern, index) => {
        const normalized = normalizeSingleSealPattern(pattern, index);
        let candidateId = normalized.id || `seal-pattern-${index + 1}`;
        while (seenIds.has(candidateId)) {
            candidateId = `${candidateId}-${index + 1}`;
        }
        normalized.id = candidateId;
        seenIds.add(candidateId);
        return normalized;
    });
    const activePatternId = patterns.some((pattern) => pattern.id === defaults.activePatternId)
        ? defaults.activePatternId
        : patterns[0].id;
    return {
        activePatternId,
        patterns,
    };
}

function cloneSealDefaultsConfig(defaults = state.defaults) {
    return JSON.parse(JSON.stringify(normalizeSealDefaultsConfig(defaults)));
}

function getSealPatternById(defaults, patternId) {
    const normalized = normalizeSealDefaultsConfig(defaults);
    return normalized.patterns.find((pattern) => pattern.id === patternId) || null;
}

function findSealPatternRef(defaults, patternId) {
    if (!defaults || typeof defaults !== "object" || !Array.isArray(defaults.patterns)) {
        return null;
    }
    return defaults.patterns.find((pattern) => pattern && pattern.id === patternId) || null;
}

function getActiveSealPattern(defaults = state.defaults) {
    const normalized = normalizeSealDefaultsConfig(defaults);
    return getSealPatternById(normalized, normalized.activePatternId) || normalized.patterns[0] || null;
}

function getCurrentSealDefaultsConfig() {
    return state.sealDefaultsDraft || state.defaults;
}

function getCurrentDraftSealPattern() {
    if (!state.sealDefaultsDraft) {
        return null;
    }
    return (
        findSealPatternRef(state.sealDefaultsDraft, state.sealDefaultsDraftPatternId) ||
        state.sealDefaultsDraft.patterns[0] ||
        null
    );
}

function getDefaultSettingInput(level, field) {
    return document.querySelector(`[data-default-level-field="${field}"][data-default-level="${level}"]`);
}

function getTemplateAnchorLevel(pattern = null) {
    const sourcePattern = pattern || getSealPatternById(state.defaults, state.templatePatternId) || getActiveSealPattern();
    if (sourcePattern && sourcePattern.percentages) {
        const exactLevel = state.levels.find((level) => parseNumber(sourcePattern.percentages[level]) === 100);
        if (exactLevel) {
            return exactLevel;
        }
    }
    const levelFromForm = state.levels.find((level) => parseNumber(getLevelInput(level, "percentage")?.value) === 100);
    if (levelFromForm) {
        return levelFromForm;
    }
    return state.levels[state.levels.length - 1] || "Master";
}

function findSealPatternByAnchor(level, threshold) {
    if (threshold === null || threshold === undefined) {
        return null;
    }
    const normalized = normalizeSealDefaultsConfig(state.defaults);
    return (
        normalized.patterns.find((pattern) => {
            const anchorLevel = getTemplateAnchorLevel(pattern);
            return anchorLevel === level && parseInteger(pattern.thresholds[level]) === parseInteger(threshold);
        }) || null
    );
}

function refreshSealDefaultPlaceholders() {
    const pattern = getActiveSealPattern();
    state.levels.forEach((level) => {
        const thresholdInput = getLevelInput(level, "threshold");
        const percentageInput = getLevelInput(level, "percentage");
        if (thresholdInput) {
            thresholdInput.placeholder = String((pattern && pattern.thresholds[level]) ?? "");
        }
        if (percentageInput) {
            percentageInput.placeholder = String((pattern && pattern.percentages[level]) ?? "");
        }
    });
}

function renderTemplatePatternHint() {
    if (!elements.sealPatternHint) {
        return;
    }
    if (!state.templatePatternId) {
        elements.sealPatternHint.textContent = "Padrao personalizado";
        return;
    }
    const pattern = getSealPatternById(state.defaults, state.templatePatternId);
    elements.sealPatternHint.textContent = pattern ? `Padrao detectado: ${pattern.name}` : "Padrao personalizado";
}

function findSealPatternByCurrentForm() {
    const normalized = normalizeSealDefaultsConfig(state.defaults);
    const exactPattern =
        normalized.patterns.find((pattern) =>
            state.levels.every((level) => {
                const currentThreshold = parseInteger(getLevelInput(level, "threshold")?.value);
                const currentPercentage = parseNumber(getLevelInput(level, "percentage")?.value);
                return (
                    currentThreshold === parseInteger(pattern.thresholds[level]) &&
                    currentPercentage === parseNumber(pattern.percentages[level])
                );
            })
        ) || null;
    if (exactPattern) {
        return exactPattern;
    }
    const anchorLevel = getTemplateAnchorLevel();
    const anchorThreshold = parseInteger(getLevelInput(anchorLevel, "threshold")?.value);
    return findSealPatternByAnchor(anchorLevel, anchorThreshold);
}

function syncTemplatePatternFromForm() {
    const pattern = findSealPatternByCurrentForm();
    state.templatePatternId = pattern ? pattern.id : null;
    renderTemplatePatternHint();
    return pattern;
}

function applySealPatternToTemplateForm(patternId, options = {}) {
    const { overwriteThresholds = true, overwritePercentages = true } = options;
    const pattern = getSealPatternById(state.defaults, patternId);
    if (!pattern) {
        return false;
    }
    state.templatePatternId = pattern.id;
    state.levels.forEach((level) => {
        const thresholdInput = getLevelInput(level, "threshold");
        const percentInput = getLevelInput(level, "percentage");
        if (thresholdInput && overwriteThresholds) {
            thresholdInput.value = pattern.thresholds[level] ?? "";
        }
        if (percentInput && overwritePercentages) {
            percentInput.value = pattern.percentages[level] ?? "";
        }
        autoFillValueFromPercent(level);
    });
    renderTemplatePatternHint();
    return true;
}

function maybeDetectSealPatternFromThreshold(level) {
    const anchorLevel = getTemplateAnchorLevel();
    if (level !== anchorLevel) {
        return;
    }
    const thresholdInput = getLevelInput(level, "threshold");
    const threshold = parseInteger(thresholdInput ? thresholdInput.value : null);
    if (threshold === null) {
        state.templatePatternId = null;
        return;
    }
    const pattern = findSealPatternByAnchor(level, threshold);
    if (!pattern) {
        state.templatePatternId = null;
        renderTemplatePatternHint();
        return;
    }
    if (pattern.id === state.templatePatternId) {
        renderTemplatePatternHint();
        return;
    }
    applySealPatternToTemplateForm(pattern.id);
    showToast(`Padrao detectado: ${pattern.name}.`);
}

function renderSealDefaultsPatternOptions() {
    if (!elements.sealDefaultsPatternSelect) {
        return;
    }
    const draft = state.sealDefaultsDraft || cloneSealDefaultsConfig();
    elements.sealDefaultsPatternSelect.innerHTML = "";
    draft.patterns.forEach((pattern) => {
        const option = document.createElement("option");
        option.value = pattern.id;
        option.textContent = pattern.name || "Padrao";
        elements.sealDefaultsPatternSelect.appendChild(option);
    });
    if (state.sealDefaultsDraftPatternId) {
        elements.sealDefaultsPatternSelect.value = state.sealDefaultsDraftPatternId;
    }
    if (elements.deleteSealDefaultPatternBtn) {
        elements.deleteSealDefaultPatternBtn.disabled = draft.patterns.length <= 1;
    }
}

function fillSealDefaultsForm() {
    const pattern = getCurrentDraftSealPattern();
    if (!pattern) {
        return;
    }
    if (elements.sealDefaultsPatternNameInput) {
        elements.sealDefaultsPatternNameInput.value = pattern.name || "";
    }
    state.levels.forEach((level) => {
        setInputValue(getDefaultSettingInput(level, "threshold"), pattern.thresholds[level]);
        setInputValue(getDefaultSettingInput(level, "percentage"), pattern.percentages[level]);
    });
}

function persistCurrentSealDefaultsDraftPattern() {
    const pattern = getCurrentDraftSealPattern();
    if (!pattern) {
        return;
    }
    const rawName = elements.sealDefaultsPatternNameInput ? elements.sealDefaultsPatternNameInput.value.trim() : "";
    pattern.name = rawName || pattern.name || "Padrao";
    state.levels.forEach((level) => {
        pattern.thresholds[level] = parseInteger(getDefaultSettingInput(level, "threshold")?.value) ?? 0;
        pattern.percentages[level] = parseNumber(getDefaultSettingInput(level, "percentage")?.value) ?? 0;
    });
}

function syncSealDefaultsDraftName() {
    const pattern = getCurrentDraftSealPattern();
    if (!pattern) {
        return;
    }
    const rawName = elements.sealDefaultsPatternNameInput ? elements.sealDefaultsPatternNameInput.value.trim() : "";
    pattern.name = rawName || pattern.name || "Padrao";
    if (elements.sealDefaultsPatternSelect) {
        const option = [...elements.sealDefaultsPatternSelect.options].find((item) => item.value === pattern.id);
        if (option) {
            option.textContent = pattern.name || "Padrao";
        }
    }
}

function syncSealDefaultsDraftLevelField(level, field) {
    const pattern = getCurrentDraftSealPattern();
    if (!pattern) {
        return;
    }
    if (field === "threshold") {
        pattern.thresholds[level] = parseInteger(getDefaultSettingInput(level, "threshold")?.value) ?? 0;
    } else if (field === "percentage") {
        pattern.percentages[level] = parseNumber(getDefaultSettingInput(level, "percentage")?.value) ?? 0;
    }
}

function bindSealDefaultsDraftInputs() {
    if (elements.sealDefaultsPatternNameInput) {
        ["input", "change", "blur"].forEach((eventName) => {
            elements.sealDefaultsPatternNameInput.addEventListener(eventName, syncSealDefaultsDraftName);
        });
    }

    document.querySelectorAll("[data-default-level-field]").forEach((input) => {
        ["input", "change"].forEach((eventName) => {
            input.addEventListener(eventName, () => {
                const level = input.dataset.defaultLevel;
                const field = input.dataset.defaultLevelField;
                if (!level || !field) {
                    return;
                }
                syncSealDefaultsDraftLevelField(level, field);
            });
        });
    });
}

function closeModalElement(modal) {
    if (!modal || !modal.id) {
        return;
    }
    switch (modal.id) {
        case "sealDefaultsModal":
            closeSealDefaultsModal();
            break;
        case "sealModal":
            closeSealModal();
            break;
        case "accountSealModal":
            closeAccountSealModal();
            break;
        case "accountManagerModal":
            closeAccountManagerModal();
            break;
        case "goldModal":
            closeGoldModal();
            break;
        case "importSealsModal":
            closeImportSealsModal();
            break;
        case "sealOcrModal":
            closeSealOcrModal();
            break;
        case "profileModal":
            closeProfileModal();
            break;
        case "userListModal":
            closeUserListModal();
            break;
        case "forgotPasswordModal":
            closeForgotPasswordModal();
            break;
        case "contactModal":
            closeContactModal();
            break;
        case "adminEmailNoticeModal":
            closeAdminEmailNoticeModal();
            break;
        default:
            break;
    }
}

function closeTopmostModal() {
    const modalStack = [
        elements.sealDefaultsModal,
        elements.userListModal,
        elements.adminEmailNoticeModal,
        elements.contactModal,
        elements.forgotPasswordModal,
        elements.profileModal,
        elements.sealOcrModal,
        elements.importSealsModal,
        elements.goldModal,
        elements.accountManagerModal,
        elements.accountSealModal,
        elements.sealModal,
    ];
    const target = modalStack.find((modal) => modal && !modal.classList.contains("hidden"));
    if (target) {
        closeModalElement(target);
    }
}

function init() {
    SEALS_PERF.mark("init-start");
    state.defaults = normalizeSealDefaultsConfig(state.defaults);
    state.templatePatternId = state.defaults.activePatternId;
    loadStoredPreferences();
    loadSealCardViewPreference();
    loadHideMaxedSealsPreference();
    syncSealCardViewControls();
    syncHideMaxedSealsControls();
    loadStoredAccountPreference({ fallbackToLast: true });
    window.AppCore.hydrateRememberedAuth(elements.loginEmail, elements.loginRemember);
    window.AppCore.syncRememberCheckboxes([elements.loginRemember, elements.registerRemember]);
    if (!state.account && state.accounts.length) {
        state.account = state.accounts[0];
    }
    loadStoredServerPreference();
    loadScopedCalculatorPreferences();
    renderServerTabs();
    loadAuthStatus({ loadAccounts: false });
    refreshSealDefaultPlaceholders();
    syncAccountControls();
    syncCalculatorControls();
    bindEvents();
    updateAttributeFilterActiveState();
    switchTab(state.tab);
    loadTemplates();
    if (state.account && state.authLogged) {
        loadAccountSeals(state.account);
    } else {
        updateCalculatorSummary();
    }
    scheduleFloatingPanelsSync();
    SEALS_PERF.mark("init-end");
    SEALS_PERF.measure("init", "init-start", "init-end");
}

function bindEvents() {
    elements.tabs.forEach((tab) => {
        tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    if (elements.accountTabs) {
        elements.accountTabs.addEventListener("click", (event) => {
            const add = event.target.closest(".account-tab--add");
            if (add) {
                handleAccountCreate();
                return;
            }
            const close = event.target.closest(".account-tab__close");
            if (close) {
                const targetAccount = close.dataset.account;
                if (targetAccount) {
                    handleAccountTabDelete(targetAccount);
                }
                return;
            }
            const tab = event.target.closest(".account-tab");
            if (!tab) {
                return;
            }
            const targetAccount = tab.dataset.account;
            if (!targetAccount || state.account === targetAccount) {
                return;
            }
            state.account = targetAccount;
            state.accountPage = 1;
            state.templatePage = 1;
            saveAccountPreference(targetAccount);
            loadScopedCalculatorPreferences({ syncControls: true });
            loadAccountSeals(state.account);
        });
        elements.accountTabs.addEventListener("dblclick", (event) => {
            const tab = event.target.closest(".account-tab");
            if (!tab || tab.classList.contains("account-tab--add") || event.target.closest(".account-tab__close")) {
                return;
            }
            startAccountInlineEdit(tab);
        });
    }

    if (elements.templateSearchInput) {
        elements.templateSearchInput.addEventListener("input", (event) => {
            const value = event.target.value.trim();
            setSearchValueForTab(value);
            if (state.tab === "account") {
                state.accountPage = 1;
                renderAccountSeals();
                return;
            }
            state.templatePage = 1;
            if (state.templateCatalogComplete) {
                renderTemplates();
                return;
            }
            window.clearTimeout(templateSearchTimer);
            templateSearchTimer = window.setTimeout(() => loadTemplates({ page: 1 }), 180);
        });
    }

    [elements.templateSimpleViewToggle, elements.accountSimpleViewToggle].forEach((button) => {
        if (!button) {
            return;
        }
        button.addEventListener("click", () => {
            setSealCardViewMode(!state.simpleSealCards);
        });
    });

    [elements.templateHideMaxedToggle, elements.accountHideMaxedToggle].forEach((button) => {
        if (!button) {
            return;
        }
        button.addEventListener("click", () => {
            setHideMaxedSealsMode(!state.hideMaxedSeals);
        });
    });

    if (elements.attributeFilter) {
        elements.attributeFilter.addEventListener("click", (event) => {
            const pill = event.target.closest(".filter-pill");
            if (!pill) {
                return;
            }
            const attribute = pill.dataset.attribute;
            if (!attribute) {
                return;
            }
            toggleAttributeFilter(attribute);
        });
    }

    if (elements.calculatorForm) {
        elements.calculatorForm.addEventListener("submit", handleCalculatorSubmit);
    }

    if (elements.calculatorAttributeSelect) {
        elements.calculatorAttributeSelect.addEventListener("change", (event) => {
            state.calculatorAttribute = event.target.value;
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            } else {
                updateCalculatorSummary();
            }
        });
    }

    if (elements.calculatorStrategySelect) {
        elements.calculatorStrategySelect.addEventListener("change", (event) => {
            state.calculatorStrategy = event.target.value || "auto";
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            } else {
                updateCalculatorSummary();
            }
        });
    }
    if (elements.calculatorBudgetToggle) {
        elements.calculatorBudgetToggle.addEventListener("change", (event) => {
            state.calculatorBudgetMode = !!event.target.checked;
            syncCalculatorBudgetInputState();
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            } else {
                updateCalculatorSummary();
                renderCalculatorResults(null);
            }
        });
    }
    if (elements.calculatorBudgetInput) {
        elements.calculatorBudgetInput.addEventListener("input", (event) => {
            state.calculatorBudget = event.target.value;
            updateGoldInputHint(
                elements.calculatorBudgetInput,
                elements.calculatorBudgetHint,
                { defaultUnitKey: "M" },
            );
            const rawValue = event.target.value.trim();
            const parsedValue = parseGoldInputValue(rawValue, { defaultUnitKey: "M" });
            if (rawValue && parsedValue === null) {
                return;
            }
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            }
        });
        elements.calculatorBudgetInput.addEventListener("blur", () => {
            const parsed = normalizeGoldInputField(
                elements.calculatorBudgetInput,
                elements.calculatorBudgetHint,
                { defaultUnitKey: "M" },
            );
            state.calculatorBudget = elements.calculatorBudgetInput.value;
            if (parsed !== null && state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            }
        });
    }

    if (elements.calculatorTargetInput) {
        elements.calculatorTargetInput.addEventListener("input", (event) => {
            state.calculatorTarget = event.target.value;
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            } else {
                updateCalculatorSummary();
                renderCalculatorResults(null);
            }
        });
    }
    if (elements.calculatorOpenersInput) {
        elements.calculatorOpenersInput.addEventListener("input", (event) => {
            state.openersOwned = parseInteger(event.target.value) || 0;
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            }
        });
    }
    if (elements.calculatorOpenerPriceInput) {
        elements.calculatorOpenerPriceInput.addEventListener("input", (event) => {
            state.openerPrice = event.target.value;
            updateGoldInputHint(
                elements.calculatorOpenerPriceInput,
                elements.calculatorOpenerPriceHint,
                { defaultUnitKey: "M" },
            );
            const rawValue = event.target.value.trim();
            const parsedValue = parseGoldInputValue(rawValue, { defaultUnitKey: "M" });
            if (!rawValue || parsedValue !== null) {
                saveCalculatorOpenerPricePreference(event.target.value);
            }
            if (rawValue && parsedValue === null) {
                return;
            }
            if (state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            }
        });
        elements.calculatorOpenerPriceInput.addEventListener("blur", () => {
            const parsed = normalizeGoldInputField(
                elements.calculatorOpenerPriceInput,
                elements.calculatorOpenerPriceHint,
                { defaultUnitKey: "M" },
            );
            state.openerPrice = elements.calculatorOpenerPriceInput.value;
            saveCalculatorOpenerPricePreference(state.openerPrice);
            if (parsed !== null && state.calculatorTarget) {
                runCalculatorWithFullCatalog();
            }
        });
    }
    if (elements.goldModalCostInput) {
        elements.goldModalCostInput.addEventListener("input", () => {
            updateGoldInputHint(elements.goldModalCostInput, elements.goldModalCostHint, {
                defaultUnitKey: "M",
            });
        });
        elements.goldModalCostInput.addEventListener("blur", () => {
            normalizeGoldInputField(elements.goldModalCostInput, elements.goldModalCostHint, {
                defaultUnitKey: "M",
            });
        });
    }
    if (elements.accountSealUnitCostInput) {
        elements.accountSealUnitCostInput.addEventListener("input", () => {
            updateGoldInputHint(
                elements.accountSealUnitCostInput,
                elements.accountSealUnitCostHint,
                { defaultUnitKey: "M" },
            );
        });
        elements.accountSealUnitCostInput.addEventListener("blur", () => {
            normalizeGoldInputField(
                elements.accountSealUnitCostInput,
                elements.accountSealUnitCostHint,
                { defaultUnitKey: "M" },
            );
        });
    }

    elements.attributeStatsPanels.forEach((panel) => {
        panel.addEventListener("click", (event) => {
            const card = event.target.closest("[data-attribute]");
            if (!card) return;
            const attribute = card.dataset.attribute;
            if (!attribute) return;
            toggleAttributeFilter(attribute);
        });
    });

    if (elements.openSealModalBtn) {
        elements.openSealModalBtn.addEventListener("click", openSealModal);
    }

    if (elements.openSealDefaultsModalBtn) {
        elements.openSealDefaultsModalBtn.addEventListener("click", openSealDefaultsModal);
    }

    if (elements.openAccountSealModalBtn) {
        elements.openAccountSealModalBtn.addEventListener("click", openAccountSealModal);
    }

    if (elements.openAccountManagerBtn) {
        elements.openAccountManagerBtn.addEventListener("click", openAccountManagerModal);
    }

    if (elements.sealForm) {
        elements.sealForm.addEventListener("submit", handleTemplateSubmit);
    }

    if (elements.sealDefaultsForm) {
        elements.sealDefaultsForm.addEventListener("submit", handleSealDefaultsSubmit);
    }

    if (elements.sealDefaultsPatternSelect) {
        elements.sealDefaultsPatternSelect.addEventListener("change", handleSealDefaultsPatternChange);
    }

    bindSealDefaultsDraftInputs();

    if (elements.createSealDefaultPatternBtn) {
        elements.createSealDefaultPatternBtn.addEventListener("click", handleCreateSealDefaultPattern);
    }

    if (elements.deleteSealDefaultPatternBtn) {
        elements.deleteSealDefaultPatternBtn.addEventListener("click", handleDeleteSealDefaultPattern);
    }

    if (elements.resetSealDefaultsBtn) {
        elements.resetSealDefaultsBtn.addEventListener("click", handleSealDefaultsReset);
    }

    if (elements.openImportSealsModalBtn) {
        elements.openImportSealsModalBtn.addEventListener("click", openImportSealsModal);
    }

    if (elements.importSealsForm) {
        elements.importSealsForm.addEventListener("submit", handleImportSealsSubmit);
    }

    if (elements.openSealOcrModalBtn) {
        elements.openSealOcrModalBtn.addEventListener("click", openSealOcrModal);
    }

    if (elements.goldModalForm) {
        elements.goldModalForm.addEventListener("submit", handleGoldModalSubmit);
    }

    if (elements.goldModalSyncBtn) {
        elements.goldModalSyncBtn.addEventListener("click", handleGoldModalSync);
    }

    if (elements.goldModalSyncAllBtn) {
        elements.goldModalSyncAllBtn.addEventListener("click", handleGoldModalSyncAll);
    }

    if (elements.goldModalSourceUserInput) {
        elements.goldModalSourceUserInput.addEventListener("input", () => {
            if (!elements.goldModalSourceUserInput.value.trim()) {
                clearGoldModalSourceSelection();
            }
            updateGoldModalSyncButtonState();
        });
        const syncSourceUser = async () => {
            await handleGoldModalSourceUserChange();
        };
        elements.goldModalSourceUserInput.addEventListener("change", syncSourceUser);
        elements.goldModalSourceUserInput.addEventListener("blur", syncSourceUser);
    }

    if (elements.goldModalSourceAccountInput) {
        elements.goldModalSourceAccountInput.addEventListener("input", updateGoldModalSyncButtonState);
        elements.goldModalSourceAccountInput.addEventListener("change", updateGoldModalSyncButtonState);
    }

    if (elements.accountSealForm) {
        elements.accountSealForm.addEventListener("submit", handleAccountSealSubmit);
    }

    if (elements.renameAccountForm) {
        elements.renameAccountForm.addEventListener("submit", handleAccountRename);
    }

    if (elements.deleteAccountForm) {
        elements.deleteAccountForm.addEventListener("submit", handleAccountDelete);
    }

    if (elements.authActionBtn) {
        elements.authActionBtn.addEventListener("click", handleAuthAction);
    }
    if (elements.loginForm) {
        elements.loginForm.addEventListener("submit", handleLoginSubmit);
    }
    if (elements.registerForm) {
        elements.registerForm.addEventListener("submit", handleRegisterSubmit);
    }
    if (elements.switchToRegister) {
        elements.switchToRegister.addEventListener("click", () => toggleAuthForms("register"));
    }
    if (elements.switchToLogin) {
        elements.switchToLogin.addEventListener("click", () => toggleAuthForms("login"));
    }
    if (elements.openForgotPasswordBtn) {
        elements.openForgotPasswordBtn.addEventListener("click", openForgotPasswordModal);
    }
    if (elements.openContactBtn) {
        elements.openContactBtn.addEventListener("click", openContactModal);
    }
    if (elements.openContactBtnRegister) {
        elements.openContactBtnRegister.addEventListener("click", openContactModal);
    }
    if (elements.forgotPasswordForm) {
        elements.forgotPasswordForm.addEventListener("submit", handleForgotPasswordSubmit);
    }
    if (elements.contactForm) {
        elements.contactForm.addEventListener("submit", handleContactSubmit);
    }
    if (elements.openLoginPanel) {
        elements.openLoginPanel.addEventListener("click", () => {
            toggleAuthForms("login");
            elements.userPanel?.classList.add("is-open");
            elements.loginEmail?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
    if (elements.themeToggle) {
        const handleToggleTheme = (event) => {
            if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
                return;
            }
            if (event.type === "keydown") {
                event.preventDefault();
            }
            const next = getNextThemeKey(state.theme);
            applyTheme(next);
            savePreferences();
        };
        elements.themeToggle.addEventListener("click", handleToggleTheme);
        elements.themeToggle.addEventListener("keydown", handleToggleTheme);
    }
    if (elements.userAvatarTrigger || elements.userAvatarImg) {
        const avatarNode = elements.userAvatarTrigger || elements.userAvatarImg;
        const handleProfileShortcut = (event) => {
            if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
                return;
            }
            if (!state.authLogged) {
                showToast("Faca login para acessar um perfil", "warning");
                return;
            }
            if (event.type === "keydown") {
                event.preventDefault();
            }
            if (elements.openProfileBtn && elements.openProfileBtn.href) {
                window.location.href = elements.openProfileBtn.href;
            }
        };
        avatarNode.addEventListener("click", handleProfileShortcut);
        avatarNode.addEventListener("keydown", handleProfileShortcut);
    }
    if (elements.openProfileBtn) {
        elements.openProfileBtn.addEventListener("click", (event) => {
            if (!state.authLogged) {
                event.preventDefault();
                showToast("Faca login ter um perfil", "warning");
            }
        });
    }

    if (elements.userPanelToggle && elements.userPanel) {
        elements.userPanelToggle.addEventListener("click", () => {
            elements.userPanel.classList.toggle("is-open");
        });
    }
    if (elements.adminPanelToggle && elements.adminPanel) {
        elements.adminPanelToggle.addEventListener("click", () => {
            elements.adminPanel.classList.toggle("is-open");
            elements.adminPanel.classList.remove("hidden");
            syncFloatingPanels();
        });
    }

    if (elements.addAdminBtn) {
        elements.addAdminBtn.addEventListener("click", handleAddAdmin);
    }
    if (elements.listUsersBtn) {
        elements.listUsersBtn.addEventListener("click", openUserListModal);
    }
    if (elements.stopImpersonateBtn) {
        elements.stopImpersonateBtn.addEventListener("click", stopImpersonation);
    }
    if (elements.downloadDbBtn) {
        elements.downloadDbBtn.addEventListener("click", handleDownloadDb);
    }
    if (elements.importDbBtn && elements.importDbInput) {
        elements.importDbBtn.addEventListener("click", () => elements.importDbInput.click());
        elements.importDbInput.addEventListener("change", (event) => {
            const file = event.target?.files?.[0];
            handleImportDb(file);
        });
    }
    if (elements.importLegacyExcelsBtn) {
        elements.importLegacyExcelsBtn.addEventListener("click", handleImportLegacyExcels);
    }
    if (elements.addServerBtn) {
        elements.addServerBtn.addEventListener("click", handleAddServer);
    }
    if (elements.openAdminEmailNoticeBtn) {
        elements.openAdminEmailNoticeBtn.addEventListener("click", openAdminEmailNoticeModal);
    }
    if (elements.adminEmailNoticeForm) {
        elements.adminEmailNoticeForm.addEventListener("submit", handleAdminEmailNoticeSubmit);
    }
    if (elements.exportMySealsPdfBtn) {
        elements.exportMySealsPdfBtn.addEventListener("click", handleExportMySealsPdf);
    }

    if (elements.sealBaseValueInput) {
        elements.sealBaseValueInput.addEventListener("input", () => {
            state.levels.forEach((level) => autoFillValueFromPercent(level));
        });
    }
    if (elements.sealAttributeSelect) {
        elements.sealAttributeSelect.addEventListener("change", () => {
            const decimals = getSealValueInputDecimals(getAttributeType());
            setNumericInputValue(elements.sealBaseValueInput, elements.sealBaseValueInput?.value, { decimals });
            state.levels.forEach((level) => autoFillValueFromPercent(level));
        });
    }

    document.addEventListener("click", (event) => {
        const closeTrigger = event.target.closest("[data-close-modal]");
        if (closeTrigger) {
            closeModalElement(closeTrigger.closest(".modal"));
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeTopmostModal();
        }
    });

    bindLevelInputs();
}

function switchTab(tabName) {
    if (!tabName) {
        return;
    }
    state.tab = tabName;
    if (tabName === "calculator") {
        syncCalculatorAttributeFromFilter();
    }
    elements.tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    const panelMap = {
        calculator: "calculatorSection",
        templates: "templatesSection",
        account: "accountSection",
    };
    document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === panelMap[tabName]);
    });
    syncSharedSearchInput();
}

function getSearchStateKey(tabName = state.tab) {
    return tabName === "account" ? "accountSearch" : "templateSearch";
}

function getSearchValueForTab(tabName = state.tab) {
    return state[getSearchStateKey(tabName)] || "";
}

function setSearchValueForTab(value, tabName = state.tab) {
    state[getSearchStateKey(tabName)] = value;
}

function syncSharedSearchInput() {
    if (!elements.templateSearchInput) {
        return;
    }
    const targetTab = state.tab === "account" ? "account" : "templates";
    const placeholder = targetTab === "account" ? "Buscar nos meus seals" : "Buscar selos";
    const nextValue = getSearchValueForTab(targetTab);
    elements.templateSearchInput.placeholder = placeholder;
    if (elements.templateSearchInput.value !== nextValue) {
        elements.templateSearchInput.value = nextValue;
    }
}

function paginateItems(items, page, pageSize) {
    const safeItems = Array.isArray(items) ? items : [];
    const safePageSize = Math.max(parseInteger(pageSize) || 1, 1);
    const totalItems = safeItems.length;
    const totalPages = Math.max(Math.ceil(totalItems / safePageSize), 1);
    const currentPage = Math.min(Math.max(parseInteger(page) || 1, 1), totalPages);
    const startIndex = (currentPage - 1) * safePageSize;
    return {
        items: safeItems.slice(startIndex, startIndex + safePageSize),
        totalItems,
        totalPages,
        currentPage,
        startIndex,
        endIndex: totalItems ? Math.min(startIndex + safePageSize, totalItems) : 0,
    };
}

function renderListPagination(container, pagination, onChange) {
    if (!container) {
        return;
    }
    const totalItems = pagination?.totalItems || 0;
    const totalPages = pagination?.totalPages || 1;
    const currentPage = pagination?.currentPage || 1;
    const startIndex = pagination?.startIndex || 0;
    const endIndex = pagination?.endIndex || 0;
    if (totalItems <= 0 || totalPages <= 1) {
        container.classList.add("hidden");
        container.innerHTML = "";
        return;
    }

    container.classList.remove("hidden");
    container.innerHTML = "";

    const summary = document.createElement("span");
    summary.className = "list-pagination__summary";
    summary.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems}`;

    const controls = document.createElement("div");
    controls.className = "list-pagination__controls";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "list-pagination__button";
    prevBtn.textContent = "Anterior";
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener("click", () => onChange(currentPage - 1));

    const pageLabel = document.createElement("span");
    pageLabel.className = "list-pagination__summary";
    pageLabel.textContent = `Pagina ${currentPage} de ${totalPages}`;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "list-pagination__button";
    nextBtn.textContent = "Proxima";
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener("click", () => onChange(currentPage + 1));

    controls.appendChild(prevBtn);
    controls.appendChild(pageLabel);
    controls.appendChild(nextBtn);
    container.appendChild(summary);
    container.appendChild(controls);
}

function syncAccountControls() {
    syncAccountTabs();
    syncAccountDatalist();
    syncAccountManagerControls();
    syncCalculatorControls();
}

function resetGuestAccountState() {
    state.accounts = [];
    state.account = "";
    state.mySeals = [];
    state.personalSealPrices = {};
    state.accountsLoaded = false;
    state.openerPrice = "";
    loadScopedCalculatorPreferences();
    syncAccountControls();
    updateProfileSummary();
    renderAccountSeals();
    renderTemplates();
    refreshCalculator();
}

function toggleAttributeFilter(attribute) {
    if (!attribute) return;
    state.attributeFilter = state.attributeFilter === attribute ? "TODOS" : attribute;
    state.templatePage = 1;
    state.accountPage = 1;
    syncCalculatorAttributeFromFilter();
    updateAttributeFilterActiveState();
    if (state.templateCatalogComplete) {
        renderTemplates();
    } else {
        loadTemplates({ page: 1 });
    }
    renderAccountSeals();
}

function syncCalculatorAttributeFromFilter() {
    const filterAttribute = String(state.attributeFilter || "TODOS").toUpperCase();
    if (!filterAttribute || filterAttribute === "TODOS") {
        return;
    }
    const availableAttributes = state.attributes.length ? state.attributes : ["AT"];
    if (!availableAttributes.includes(filterAttribute)) {
        return;
    }
    const changed = state.calculatorAttribute !== filterAttribute;
    state.calculatorAttribute = filterAttribute;
    syncCalculatorControls();
    if (changed && state.calculatorTarget) {
        runCalculatorWithFullCatalog();
    }
}

function syncAccountTabs() {
    if (!elements.accountTabs) {
        return;
    }
    elements.accountTabs.innerHTML = "";
    if (!state.accounts.length) {
        const placeholder = document.createElement("p");
        placeholder.className = "account-tabs__empty";
        placeholder.textContent = "Nenhum perfil de jogo encontrado";
        elements.accountTabs.appendChild(placeholder);
    }
    state.accounts.forEach((account) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "account-tab";
        if (account === state.account) {
            button.classList.add("active");
        }
        button.dataset.account = account;
        button.draggable = true;

        button.addEventListener("dragstart", (event) => {
            state.draggingAccount = account;
            button.classList.add("account-tab--dragging");
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
            }
        });
        button.addEventListener("dragend", () => {
            clearAccountDragState();
        });
        button.addEventListener("dragover", (event) => {
            if (!state.draggingAccount || state.draggingAccount === account) {
                return;
            }
            event.preventDefault();
            button.classList.add("account-tab--drag-over");
        });
        button.addEventListener("dragleave", () => {
            button.classList.remove("account-tab--drag-over");
        });
        button.addEventListener("drop", async (event) => {
            event.preventDefault();
            if (!state.draggingAccount || state.draggingAccount === account) {
                clearAccountDragState();
                return;
            }
            const nextOrder = buildAccountReorder(state.accounts, state.draggingAccount, account);
            clearAccountDragState();
            await applyAccountOrder(nextOrder);
        });

        const label = document.createElement("span");
        label.className = "account-tab__label";
        label.textContent = account;
        label.title = account;
        const close = document.createElement("button");
        close.type = "button";
        close.className = "account-tab__close";
        close.innerHTML = "&times;";
        close.dataset.account = account;
        button.appendChild(label);
        button.appendChild(close);
        elements.accountTabs.appendChild(button);
    });
    elements.accountTabs.appendChild(buildAddAccountButton());
    scrollActiveAccountTabIntoView();
}

function buildAddAccountButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "account-tab account-tab--add";
    button.setAttribute("aria-label", "Adicionar perfil de jogo");
    button.textContent = "+ Novo perfil";
    return button;
}

function clearAccountDragState() {
    state.draggingAccount = null;
    document.querySelectorAll(".account-tab").forEach((node) => {
        node.classList.remove("account-tab--dragging", "account-tab--drag-over");
    });
}

function scrollActiveAccountTabIntoView() {
    if (!elements.accountTabs) {
        return;
    }
    const activeTab = elements.accountTabs.querySelector(".account-tab.active");
    if (!activeTab) {
        return;
    }
    window.requestAnimationFrame(() => {
        activeTab.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth",
        });
    });
}

function buildAccountReorder(order, fromAccount, toAccount) {
    const list = Array.isArray(order) ? order.slice() : [];
    const fromIndex = list.indexOf(fromAccount);
    const toIndex = list.indexOf(toAccount);
    if (fromIndex === -1 || toIndex === -1) {
        return list;
    }
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    return list;
}

async function applyAccountOrder(order) {
    state.accounts = order;
    syncAccountTabs();
    try {
        const response = await fetch("/api/accounts/order", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao salvar a ordem dos perfis de jogo.");
        }
        if (Array.isArray(payload.accounts)) {
            state.accounts = payload.accounts;
            syncAccountTabs();
        }
        showToast(payload.message || "Ordem dos perfis de jogo atualizada.");
    } catch (error) {
        showToast(error.message || "Falha ao salvar a ordem dos perfis de jogo.", "error");
        if (state.account) {
            await loadAccountSeals(state.account);
        }
    }
}

function syncAccountDatalist() {
    if (!elements.accountOptionsDatalist) {
        return;
    }
    elements.accountOptionsDatalist.innerHTML = "";
    state.accounts.forEach((account) => {
        const option = document.createElement("option");
        option.value = account;
        elements.accountOptionsDatalist.appendChild(option);
    });
}

function syncAccountManagerControls() {
    const selects = [elements.renameAccountSelect, elements.deleteAccountSelect];
    const preferred = getActiveAccount();
    selects.forEach((select) => {
        if (!select) {
            return;
        }
        const previous = select.value;
        select.innerHTML = "";
        state.accounts.forEach((account) => {
            const option = document.createElement("option");
            option.value = account;
            option.textContent = account;
            select.appendChild(option);
        });
        if (!state.accounts.length) {
            return;
        }
        const target = state.accounts.includes(previous)
            ? previous
            : state.accounts.includes(preferred)
                ? preferred
                : state.accounts[0];
        select.value = target;
    });
    if (elements.renameAccountInput) {
        elements.renameAccountInput.value = "";
    }
}

function applyAccountPayload(payload, fallbackAccount) {
    state.accounts = payload.accounts || state.accounts;
    state.account = payload.account || fallbackAccount || state.account;
    state.templatePage = 1;
    state.accountPage = 1;
    if (state.account) {
        saveAccountPreference(state.account);
    } else {
        clearStoredAccountPreference();
    }
    loadScopedCalculatorPreferences();
    syncAccountControls();
    updateProfileSummary();
}

async function apiRenameAccount(oldName, newName) {
    const response = await fetch(`/api/accounts/${encodeURIComponent(oldName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || "Erro ao renomear o perfil de jogo.");
    }
    return payload;
}

async function apiDeleteAccount(accountName) {
    const response = await fetch(`/api/accounts/${encodeURIComponent(accountName)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || "Erro ao excluir o perfil de jogo.");
    }
    return payload;
}

async function apiCreateAccount(name) {
    const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || "Erro ao criar o perfil de jogo.");
    }
    return payload;
}

function syncCalculatorBudgetInputState() {
    if (!elements.calculatorBudgetInput) {
        return;
    }
    elements.calculatorBudgetInput.disabled = !state.calculatorBudgetMode;
}

function syncCalculatorControls() {
    if (elements.calculatorAttributeSelect) {
        elements.calculatorAttributeSelect.innerHTML = "";
        const availableAttributes = state.attributes.length ? state.attributes : ["AT"];
        availableAttributes.forEach((attribute) => {
            const option = document.createElement("option");
            option.value = attribute;
            option.textContent = attribute;
            elements.calculatorAttributeSelect.appendChild(option);
        });
        const selectedAttribute = availableAttributes.includes(state.calculatorAttribute)
            ? state.calculatorAttribute
            : availableAttributes[0];
        state.calculatorAttribute = selectedAttribute;
        elements.calculatorAttributeSelect.value = selectedAttribute;
    }
    if (elements.calculatorAccountLabel) {
        elements.calculatorAccountLabel.textContent = getActiveAccount() || "Nenhuma";
    }
    if (elements.calculatorOpenersInput) {
        elements.calculatorOpenersInput.value = state.openersOwned || "";
    }
    if (elements.calculatorOpenerPriceInput) {
        elements.calculatorOpenerPriceInput.value = state.openerPrice || "";
        updateGoldInputHint(
            elements.calculatorOpenerPriceInput,
            elements.calculatorOpenerPriceHint,
            { defaultUnitKey: "M" },
        );
    }
    if (elements.calculatorStrategySelect) {
        const availableStrategies = Object.keys(CALCULATOR_STRATEGY_LABELS);
        if (!availableStrategies.includes(state.calculatorStrategy)) {
            state.calculatorStrategy = "auto";
        }
        elements.calculatorStrategySelect.value = state.calculatorStrategy;
    }
    if (elements.calculatorBudgetToggle) {
        elements.calculatorBudgetToggle.checked = !!state.calculatorBudgetMode;
    }
    if (elements.calculatorBudgetInput) {
        elements.calculatorBudgetInput.value = state.calculatorBudget || "";
        updateGoldInputHint(elements.calculatorBudgetInput, elements.calculatorBudgetHint, {
            defaultUnitKey: "M",
        });
    }
    syncCalculatorBudgetInputState();
}

function getActiveAccount() {
    if (state.account) {
        return state.account;
    }
    if (state.accounts.length) {
        return state.accounts[0];
    }
    return "";
}

function getAccountPreferenceKey(email = state.authEmail) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    return normalizedEmail ? `seal_account_${normalizedEmail}` : "seal_account_guest";
}

function saveAccountPreference(account = getActiveAccount(), email = state.authEmail) {
    const normalizedAccount = String(account || "").trim();
    if (!normalizedAccount) {
        clearStoredAccountPreference(email);
        return "";
    }
    localStorage.setItem(getAccountPreferenceKey(email), normalizedAccount);
    localStorage.setItem("seal_account_last", normalizedAccount);
    return normalizedAccount;
}

function loadStoredAccountPreference(options = {}) {
    const { email = state.authEmail, fallbackToLast = false, apply = true } = options;
    const saved =
        localStorage.getItem(getAccountPreferenceKey(email)) ||
        (fallbackToLast ? localStorage.getItem("seal_account_last") : "") ||
        "";
    if (saved && apply) {
        state.account = saved;
    }
    return saved;
}

function clearStoredAccountPreference(email = state.authEmail) {
    localStorage.removeItem(getAccountPreferenceKey(email));
    if (!String(email || "").trim()) {
        localStorage.removeItem("seal_account_last");
    }
}

function getCalculatorOpenerPricePreferenceKey(options = {}) {
    const email = String(options.email !== undefined ? options.email : state.authEmail || "")
        .trim()
        .toLowerCase();
    const account = String(options.account !== undefined ? options.account : getActiveAccount() || "").trim();
    const serverKey = String(
        options.serverKey !== undefined ? options.serverKey : getCurrentServerKey() || "",
    ).trim();
    if (!account || !serverKey) {
        return "";
    }
    const scope = email || "guest";
    return `seal_calculator_opener_price_${scope}_${serverKey}_${account}`;
}

function saveCalculatorOpenerPricePreference(value = state.openerPrice, options = {}) {
    const key = getCalculatorOpenerPricePreferenceKey(options);
    if (!key) {
        return "";
    }
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
        localStorage.removeItem(key);
        return "";
    }
    localStorage.setItem(key, normalizedValue);
    return normalizedValue;
}

function loadStoredCalculatorOpenerPrice(options = {}) {
    const { apply = true } = options;
    const key = getCalculatorOpenerPricePreferenceKey(options);
    const saved = key ? localStorage.getItem(key) || "" : "";
    if (apply) {
        state.openerPrice = saved;
    }
    return saved;
}

function loadScopedCalculatorPreferences(options = {}) {
    const { syncControls = false } = options;
    state.openerPrice = loadStoredCalculatorOpenerPrice({ apply: false }) || "";
    try {
        const saved = JSON.parse(localStorage.getItem("dmowiki.seals.calculator-state") || "null");
        if (saved && typeof saved === "object") {
            state.calculatorAttribute = saved.calculatorAttribute || state.calculatorAttribute;
            state.calculatorStrategy = saved.calculatorStrategy || state.calculatorStrategy;
            state.calculatorBudgetMode = !!saved.calculatorBudgetMode;
            state.calculatorBudget = saved.calculatorBudget || "";
            state.calculatorTarget = saved.calculatorTarget || "";
            state.openersOwned = Math.max(parseInteger(saved.openersOwned) || 0, 0);
        }
    } catch (_error) {
    }
    if (syncControls) {
        syncCalculatorControls();
    }
}

function clearStoredCalculatorOpenerPricePreference(options = {}) {
    const key = getCalculatorOpenerPricePreferenceKey(options);
    if (key) {
        localStorage.removeItem(key);
    }
}

function clearStoredCalculatorOpenerPricePreferencesForAccount(account, options = {}) {
    const normalizedAccount = String(account || "").trim();
    if (!normalizedAccount) {
        return;
    }
    const email = options.email !== undefined ? options.email : state.authEmail;
    const serverKeys = [...new Set(((state.servers || []).map((server) => server?.key).filter(Boolean)))];
    const scopedServerKeys = serverKeys.length
        ? serverKeys
        : [options.serverKey !== undefined ? options.serverKey : getCurrentServerKey()].filter(Boolean);
    scopedServerKeys.forEach((serverKey) => {
        clearStoredCalculatorOpenerPricePreference({
            email,
            serverKey,
            account: normalizedAccount,
        });
    });
}

function migrateStoredCalculatorOpenerPricePreference(oldAccount, newAccount, options = {}) {
    const fromAccount = String(oldAccount || "").trim();
    const toAccount = String(newAccount || "").trim();
    if (!fromAccount || !toAccount || fromAccount === toAccount) {
        return;
    }
    const email = options.email !== undefined ? options.email : state.authEmail;
    const serverKeys = [...new Set(((state.servers || []).map((server) => server?.key).filter(Boolean)))];
    const scopedServerKeys = serverKeys.length
        ? serverKeys
        : [options.serverKey !== undefined ? options.serverKey : getCurrentServerKey()].filter(Boolean);
    scopedServerKeys.forEach((serverKey) => {
        const fromKey = getCalculatorOpenerPricePreferenceKey({
            email,
            serverKey,
            account: fromAccount,
        });
        const toKey = getCalculatorOpenerPricePreferenceKey({
            email,
            serverKey,
            account: toAccount,
        });
        if (!fromKey || !toKey) {
            return;
        }
        const savedValue = localStorage.getItem(fromKey);
        if (savedValue !== null) {
            localStorage.setItem(toKey, savedValue);
            localStorage.removeItem(fromKey);
        }
    });
}

function getBlockedTemplateSet() {
    const list = Array.isArray(state.blockedTemplates) ? state.blockedTemplates : [];
    const ids = list
        .map((id) => parseInteger(id))
        .filter((id) => id !== null && !Number.isNaN(id));
    return new Set(ids);
}

function compareTemplateOrder(a, b) {
    const orderA = parseInteger(a && a.orderIndex) || 0;
    const orderB = parseInteger(b && b.orderIndex) || 0;
    if (orderA !== orderB) {
        return orderA - orderB;
    }
    const idA = parseInteger(a && a.id) || 0;
    const idB = parseInteger(b && b.id) || 0;
    return idA - idB;
}

function sortTemplatesInState() {
    state.templates.sort(compareTemplateOrder);
}

function sortAccountSeals() {
    state.mySeals.sort((a, b) => compareTemplateOrder(a.template, b.template));
}

function normalizeSealTemplate(template) {
    if (!template || typeof template !== "object") {
        return template;
    }
    if (template.c === 1 || Array.isArray(template.l)) {
        const compactLevels = Array.isArray(template.l) ? template.l : [];
        const levels = {};
        state.levels.forEach((levelName, index) => {
            const row = Array.isArray(compactLevels[index]) ? compactLevels[index] : [];
            levels[levelName] = {
                threshold: row[0] ?? null,
                percentage: row[1] ?? null,
                value: row[2] ?? null,
            };
        });
        return {
            id: template.id,
            account: template.ac || "__template__",
            name: template.n || "",
            attribute: template.a || "",
            baseValue: template.b ?? 0,
            unitCost: template.u ?? 0,
            unitCosts: template.us && typeof template.us === "object" ? template.us : {},
            orderIndex: template.o ?? template.id ?? 0,
            levels,
            createdAt: template.ca || "",
        };
    }
    const levels = { ...(template.levels || {}) };
    state.levels.forEach((levelName) => {
        if (!levels[levelName]) {
            levels[levelName] = { threshold: null, percentage: null, value: null };
        }
    });
    return { ...template, levels };
}

function normalizeSealTemplates(templates) {
    return Array.isArray(templates) ? templates.map(normalizeSealTemplate) : [];
}

function normalizeAccountSealEntry(entry) {
    if (!entry || typeof entry !== "object") {
        return entry;
    }
    return {
        ...entry,
        template: normalizeSealTemplate(entry.template),
    };
}

function readApiCache(cacheKey) {
    try {
        const raw = localStorage.getItem(`${SEALS_API_CACHE_PREFIX}${cacheKey}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
    } catch (_error) {
        return null;
    }
}

function writeApiCache(cacheKey, payload, etag = "") {
    try {
        localStorage.setItem(`${SEALS_API_CACHE_PREFIX}${cacheKey}`, JSON.stringify({
            storedAt: Date.now(),
            etag,
            payload,
        }));
    } catch (_error) {
    }
}

function clearSealsApiCache() {
    try {
        Object.keys(localStorage)
            .filter((key) => key.startsWith(SEALS_API_CACHE_PREFIX))
            .forEach((key) => localStorage.removeItem(key));
    } catch (_error) {
    }
}

async function fetchCachedJson(url, cacheKey, maxAge = SEALS_API_CACHE_MAX_AGE) {
    const cached = readApiCache(cacheKey);
    if (cached?.payload && Date.now() - Number(cached.storedAt || 0) < maxAge) {
        return cached.payload;
    }
    const headers = new Headers();
    if (cached?.etag) {
        headers.set("If-None-Match", cached.etag);
    }
    const response = await fetch(url, { headers });
    if (response.status === 304 && cached?.payload) {
        cached.storedAt = Date.now();
        writeApiCache(cacheKey, cached.payload, cached.etag);
        return cached.payload;
    }
    const payload = await response.json();
    if (!response.ok) {
        const error = new Error(payload.error || "Falha ao carregar dados.");
        error.status = response.status;
        throw error;
    }
    writeApiCache(cacheKey, payload, response.headers.get("ETag") || "");
    return payload;
}

function sealsApiCacheKey(params) {
    return params.toString();
}

function takeInitialSealPayload(params) {
    if (initialSealPayloadConsumed || !APP_CONFIG.initialSealPayload) {
        return null;
    }
    const page = params.get("page") || "1";
    const pageSize = params.get("pageSize") || String(TEMPLATE_PAGE_SIZE);
    const hasFilters = !!params.get("search") || (params.get("attribute") && params.get("attribute") !== "TODOS");
    const isFull = params.get("all") === "1" || Number(pageSize) >= 500;
    const sameServer = String(params.get("server") || "") === String(APP_CONFIG.initialSealPayload.serverKey || APP_CONFIG.defaultServer || "");
    if (isFull || hasFilters || page !== "1" || pageSize !== String(TEMPLATE_PAGE_SIZE) || !sameServer) {
        return null;
    }
    initialSealPayloadConsumed = true;
    writeApiCache(sealsApiCacheKey(params), APP_CONFIG.initialSealPayload);
    return APP_CONFIG.initialSealPayload;
}

function bindLevelInputs() {
    document.querySelectorAll("[data-level-field]").forEach((input) => {
        input.addEventListener("input", () => {
            const level = input.dataset.level;
            const field = input.dataset.levelField;
            if (field === "percentage") {
                autoFillValueFromPercent(level);
                syncTemplatePatternFromForm();
            } else if (field === "value") {
                autoFillPercentFromValue(level);
                syncTemplatePatternFromForm();
            } else if (field === "threshold") {
                maybeDetectSealPatternFromThreshold(level);
            }
        });
    });
}


function getCurrencyIconUrl(iconName) {
    if (!iconName) {
        return "";
    }
    const base = state.currencyBasePath ? state.currencyBasePath.replace(/\/$/, "") : "";
    return base ? `${base}/${iconName}` : iconName;
}

function prepareIconImage(img, { lazy = true } = {}) {
    if (!img) return img;
    img.width = 20;
    img.height = 20;
    img.decoding = "async";
    if (lazy) {
        img.loading = "lazy";
    }
    return img;
}

function getDefaultGoldUnit() {
    if (state.defaultGoldUnit) {
        const target = state.goldUnits.find((unit) => unit.key === state.defaultGoldUnit);
        if (target) {
            return target;
        }
    }
    return state.goldUnits[0] || { key: "", factor: 1, icon: "" };
}

function getGoldUnitByKey(key) {
    return state.goldUnits.find((unit) => unit.key === key) || getDefaultGoldUnit();
}

function getCurrentServerKey() {
    const validKeys = (state.servers || []).map((srv) => srv.key);
    if (!validKeys.length) {
        state.serverKey = "";
        return "";
    }
    if (!state.serverKey || !validKeys.includes(state.serverKey)) {
        state.serverKey = validKeys[0];
    }
    return state.serverKey;
}

function getCurrentServerLabel() {
    const key = getCurrentServerKey();
    const server = (state.servers || []).find((srv) => srv.key === key);
    return server ? server.label : key || "Servidor";
}

function saveServerPreference() {
    const key = state.authEmail ? `seal_server_${state.authEmail}` : "seal_server_guest";
    localStorage.setItem(key, getCurrentServerKey());
}

function loadStoredServerPreference() {
    const key = state.authEmail ? `seal_server_${state.authEmail}` : "seal_server_guest";
    const saved = localStorage.getItem(key);
    if (saved) {
        state.serverKey = saved;
    }
    getCurrentServerKey();
}

function setServer(key) {
    state.serverKey = key;
    state.templatePage = 1;
    state.accountPage = 1;
    getCurrentServerKey();
    saveServerPreference();
    loadScopedCalculatorPreferences({ syncControls: true });
    renderServerTabs();
    loadTemplates();
    if (getActiveAccount()) {
        loadAccountSeals(getActiveAccount());
    } else {
        renderAccountSeals();
    }
    refreshCalculator();
}

function renderServerTabs() {
    if (!elements.serverTabs) return;
    elements.serverTabs.innerHTML = "";
    const servers = state.servers || [];
    if (!servers.length) {
        const fallback = document.createElement("span");
        fallback.className = "server-tab__empty";
        fallback.textContent = "Nenhum servidor cadastrado";
        elements.serverTabs.appendChild(fallback);
        return;
    }
    const active = getCurrentServerKey();
    servers.forEach((srv) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-pill";
        btn.dataset.server = srv.key;
        btn.textContent = srv.label || srv.key;
        if (srv.key === active) {
            btn.classList.add("active");
        }
        btn.addEventListener("click", () => setServer(srv.key));
        elements.serverTabs.appendChild(btn);
    });
}

function getTemplateUnitCost(template, serverKey = getCurrentServerKey()) {
    if (!template) return 0;
    if (serverKey === getCurrentServerKey() && Object.prototype.hasOwnProperty.call(state.personalSealPrices || {}, template.id)) {
        return state.personalSealPrices[template.id];
    }
    const costs = template.unitCosts || {};
    const hasAnyServerCost = Object.keys(costs).length > 0;
    if (hasAnyServerCost && costs[serverKey] !== undefined && costs[serverKey] !== null) {
        return costs[serverKey];
    }
    if (hasAnyServerCost) {
        // Se jÃ¡ temos mapa por servidor, mas nÃ£o hÃ¡ valor para este, nÃ£o herda de outro.
        return 0;
    }
    // Compatibilidade com dados antigos: usa unitCost Ãºnico.
    return template.unitCost || 0;
}

function getAccountUnitCost(entry, template, serverKey = getCurrentServerKey()) {
    if (entry && entry.unitCost !== undefined && entry.unitCost !== null) {
        return entry.unitCost;
    }
    return getTemplateUnitCost(template, serverKey);
}

function updateCurrencyRowValue(row, unitCost) {
    if (!row) return;
    const display = formatGoldDisplay(unitCost);
    const iconUrl = getCurrencyIconUrl(display.icon);
    let icon = row.querySelector(".currency-icon");
    if (iconUrl) {
        if (!icon) {
            icon = document.createElement("img");
            icon.className = "currency-icon";
            prepareIconImage(icon);
            row.insertBefore(icon, row.firstChild);
        }
        icon.alt = display.unit || "";
        icon.src = iconUrl;
    } else if (icon) {
        icon.remove();
    }
    const value = row.querySelector(".currency-text");
    if (value) {
        value.textContent = formatGoldText(display);
    }
}

function updateSingleSealGoldViews(templateId) {
    const id = parseInteger(templateId);
    if (id === null) return;
    const template = state.templates.find((item) => parseInteger(item.id) === id);
    if (!template) return;
    const account = getActiveAccount();
    const entry = state.mySeals.find(
        (item) => parseInteger(item.sealId) === id && (!account || item.account === account),
    ) || null;
    const unitCost = getAccountUnitCost(entry, template);
    [elements.templateList, elements.accountSealList].forEach((container) => {
        container?.querySelectorAll(`[data-template-id="${id}"] .seal-card__currency`).forEach((row) => {
            updateCurrencyRowValue(row, unitCost);
        });
    });
    renderAccountTotalGold();
    updateCalculatorSummary();
    if (state.calculatorTarget) {
        const plan = buildCalculatorPlan(state.calculatorAttribute, state.calculatorTarget);
        state.calculatorPlan = plan;
        renderCalculatorResults(plan);
    }
}

function setGlobalSealGoldInState(templateId, serverKey, unitCost, authoritativeTemplate = null) {
    const id = parseInteger(templateId);
    if (id === null) return;
    const replaceTemplate = (template) => {
        if (!template || parseInteger(template.id) !== id) return template;
        if (authoritativeTemplate) {
            return normalizeSealTemplate(authoritativeTemplate);
        }
        return {
            ...template,
            unitCosts: { ...(template.unitCosts || {}), [serverKey]: unitCost },
        };
    };
    state.templates = state.templates.map(replaceTemplate);
    state.mySeals = state.mySeals.map((entry) => ({
        ...entry,
        template: replaceTemplate(entry.template),
    }));
    updateSingleSealGoldViews(id);
}

function setPersonalSealGoldInState(templateId, account, unitCost) {
    const id = parseInteger(templateId);
    if (id === null) return;
    state.personalSealPrices = { ...(state.personalSealPrices || {}), [id]: unitCost };
    state.mySeals = state.mySeals.map((entry) => (
        parseInteger(entry.sealId) === id && entry.account === account
            ? { ...entry, unitCost }
            : entry
    ));
    updateSingleSealGoldViews(id);
}

function hasConfiguredSealUnitCost(entry, template, serverKey = getCurrentServerKey()) {
    const unitCost = parseNumber(getAccountUnitCost(entry, template, serverKey));
    return unitCost !== null && unitCost > 0;
}

function getGoldInputDefaultUnitKey() {
    return state.defaultGoldUnit || "M";
}

function formatGoldText(display) {
    if (!display) {
        return "--";
    }
    if (display.amount === "--") {
        return display.unit ? `${display.unit} --` : "--";
    }
    return display.unit ? `${display.amount}${display.unit}` : display.amount;
}

function formatGoldDisplay(value, options = {}) {
    const { zeroAsValue = false } = options;
    const numeric = parseNumber(value);
    if (numeric === null) {
        const fallbackUnit = getDefaultGoldUnit();
        return {
            amount: "--",
            unit: fallbackUnit.key,
            icon: fallbackUnit.icon,
        };
    }
    if (numeric === 0 && !zeroAsValue) {
        const fallbackUnit = getDefaultGoldUnit();
        return {
            amount: "--",
            unit: fallbackUnit.key,
            icon: fallbackUnit.icon,
        };
    }
    const sortedUnits = [...state.goldUnits].sort((a, b) => (b.factor || 0) - (a.factor || 0));
    let selectedUnit = getGoldUnitByKey("B");
    let amount = numeric;
    for (const unit of sortedUnits) {
        if (!unit.factor) {
            continue;
        }
        const quotient = numeric / unit.factor;
        if (quotient >= 1) {
            selectedUnit = unit;
            amount = quotient;
            break;
        }
    }
    const rounded = roundNumber(amount, amount >= 10 ? 1 : 2);
    return {
        amount: goldFormatter.format(rounded),
        unit: selectedUnit.key,
        icon: selectedUnit.icon,
    };
}

function parseGoldInputValue(value, options = {}) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    const raw = String(value).trim();
    if (!raw) {
        return null;
    }
    const match = raw.match(/^([+-]?[0-9][0-9.,]*)\s*([a-zA-Z]+)?$/);
    if (!match) {
        return null;
    }
    let numericToken = match[1];
    if (numericToken.includes(".") && !numericToken.includes(",") && /^\d{1,3}(\.\d{3})+$/.test(numericToken)) {
        numericToken = numericToken.replace(/\./g, "");
    }
    const amount = parseNumber(numericToken);
    if (amount === null) {
        return null;
    }
    const defaultUnitKey = (options.defaultUnitKey || getGoldInputDefaultUnitKey() || "M").toUpperCase();
    const unitAliases = {
        B: "B",
        BIT: "B",
        BITS: "B",
        M: "M",
        MEGA: "M",
        MEGAS: "M",
        T: "T",
        TERA: "T",
        TERAS: "T",
    };
    const explicitUnit = (match[2] || "").trim().toUpperCase();
    const unitKey = unitAliases[explicitUnit] || defaultUnitKey;
    const unit = getGoldUnitByKey(unitKey);
    const factor = unit && unit.factor ? unit.factor : 1;
    return amount * factor;
}

function formatGoldCompactValue(value) {
    const numeric = parseNumber(value);
    if (numeric === null) {
        return "";
    }
    if (numeric === 0) {
        return "0B";
    }
    return formatGoldText(formatGoldDisplay(numeric, { zeroAsValue: true }));
}

function formatGoldBreakdown(value) {
    const numeric = parseNumber(value);
    if (numeric === null) {
        const unit = getDefaultGoldUnit();
        return { parts: [], primaryUnit: unit.key, primaryIcon: unit.icon };
    }
    if (numeric === 0) {
        const bitUnit = getGoldUnitByKey("B");
        return {
            parts: [{ amount: 0, unit: bitUnit.key, icon: bitUnit.icon }],
            primaryUnit: bitUnit.key,
            primaryIcon: bitUnit.icon,
        };
    }
    const sortedUnits = [...state.goldUnits].sort((a, b) => (b.factor || 0) - (a.factor || 0));
    const parts = [];
    let remainder = numeric;
    sortedUnits.forEach((unit) => {
        if (!unit.factor) return;
        const count = Math.floor(remainder / unit.factor);
        if (count > 0) {
            parts.push({ amount: count, unit: unit.key, icon: unit.icon });
            remainder -= count * unit.factor;
        }
    });
    const smallest = sortedUnits[sortedUnits.length - 1] || getDefaultGoldUnit();
    const roundedRemainder = Math.round(remainder * 100) / 100;
    if (roundedRemainder > 0.0001) {
        parts.push({ amount: roundedRemainder, unit: smallest.key, icon: smallest.icon });
    }
    const primary = parts[0] || { unit: smallest.key, icon: smallest.icon };
    return { parts, primaryUnit: primary.unit, primaryIcon: primary.icon };
}

function formatGoldPartsText(value) {
    const breakdown = formatGoldBreakdown(value);
    if (!breakdown.parts.length) {
        return "0B";
    }
    return breakdown.parts.map((part) => `${goldFormatter.format(part.amount)}${part.unit}`).join(" ");
}

function getGoldInputHintText(value, options = {}) {
    const emptyText = options.emptyText || "Aceita B, M ou T. Sem unidade, assume Mega.";
    if (value === undefined || value === null || String(value).trim() === "") {
        return emptyText;
    }
    const parsed = parseGoldInputValue(value, options);
    if (parsed === null) {
        return "Formato invalido. Use exemplos como 250B, 1,5M ou 2T.";
    }
    return `Equivale a ${formatGoldPartsText(parsed)}. Principal: ${formatGoldCompactValue(parsed)}.`;
}

function updateGoldInputHint(input, hint, options = {}) {
    if (!hint) {
        return;
    }
    hint.textContent = getGoldInputHintText(input ? input.value : "", options);
}

function normalizeGoldInputField(input, hint, options = {}) {
    if (!input) {
        return null;
    }
    const parsed = parseGoldInputValue(input.value, options);
    if (parsed !== null) {
        input.value = formatGoldCompactValue(parsed);
    }
    updateGoldInputHint(input, hint, options);
    return parsed;
}

function renderGoldInline(target, breakdown) {
    if (!target) return;
    target.innerHTML = "";
    if (!breakdown || !breakdown.parts || !breakdown.parts.length) {
        target.textContent = "--";
        return;
    }
    breakdown.parts.forEach((part, index) => {
        const wrapper = document.createElement("span");
        wrapper.className = "gold-part";
        const amountEl = document.createElement("span");
        amountEl.className = "gold-part__amount";
        amountEl.textContent = goldFormatter.format(part.amount);
        wrapper.appendChild(amountEl);
        if (part.icon) {
            const iconEl = document.createElement("img");
            iconEl.className = "currency-icon currency-icon--inline";
            prepareIconImage(iconEl);
            iconEl.src = getCurrencyIconUrl(part.icon);
            iconEl.alt = part.unit || "";
            wrapper.appendChild(iconEl);
        }
        target.appendChild(wrapper);
        if (index < breakdown.parts.length - 1) {
            target.appendChild(document.createTextNode(" "));
        }
    });
}

function formatPdfFilenamePart(value, fallback = "plano") {
    return String(value || fallback)
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || fallback;
}

function applyServersPayload(payload) {
    if (payload && Array.isArray(payload.servers)) {
        state.servers = payload.servers;
        if (payload.defaultServer) {
            state.serverKey = state.serverKey || payload.defaultServer;
        }
        getCurrentServerKey();
        renderServerTabs();
        renderServerAdminList();
    }
}

async function loadServers() {
    try {
        const response = await fetch("/api/servers");
        const payload = await response.json();
        if (!response.ok) {
            return;
        }
        applyServersPayload(payload);
    } catch (error) {
        // silencioso para evitar ruÃ­do no init
    }
}

function renderServerAdminList() {
    if (!elements.serverAdminList) return;
    elements.serverAdminList.innerHTML = "";
    if (!state.isAdmin) {
        elements.serverAdminList.textContent = "Apenas admins podem gerenciar.";
        return;
    }
    if (!state.servers || !state.servers.length) {
        elements.serverAdminList.textContent = "Nenhum servidor cadastrado.";
        return;
    }
    state.servers.forEach((server) => {
        const li = document.createElement("li");
        li.className = "admin-list__item";
        const label = document.createElement("span");
        label.className = "admin-list__label";
        label.textContent = `${server.label || server.key} (${server.key})`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ghost-btn ghost-btn--danger ghost-btn--sm";
        remove.textContent = "X";
        remove.addEventListener("click", () => handleDeleteServer(server.key));
        li.appendChild(label);
        li.appendChild(remove);
        elements.serverAdminList.appendChild(li);
    });
}

function renderAccountTotalGold() {
    if (!elements.accountTotalGoldText) {
        return;
    }
    const totalGold = state.mySeals.reduce((sum, entry) => {
        const template = entry.template || {};
        const unitCost = getAccountUnitCost(entry, template);
        const quantity = entry.quantity || 0;
        return sum + unitCost * quantity;
    }, 0);
    const breakdown = formatGoldBreakdown(totalGold);
    renderGoldInline(elements.accountTotalGoldText, breakdown);
    if (elements.accountTotalGoldIcon) {
        elements.accountTotalGoldIcon.style.display = "none";
    }
}

function createLevelPopover(template, quantity = 0) {
    const container = document.createElement("div");
    container.className = "template-level-popover";
    const title = document.createElement("p");
    title.className = "template-level-popover__title";
    title.textContent = "NÃ­veis do Selo";
    container.appendChild(title);

    const levels = state.levels.map((levelName) => {
        const level = template.levels[levelName] || {};
        const threshold = parseNumber(level.threshold) || 0;
        return { name: levelName, threshold };
    });
    const numericLevels = levels.filter((lvl) => lvl.threshold > 0).sort((a, b) => a.threshold - b.threshold);
    const highlight = pickHighlightLevel(numericLevels, quantity);
    const pills = document.createElement("div");
    pills.className = "level-pill-row";
    levels.forEach((lvl) => {
        const pill = document.createElement("span");
        pill.className = "level-pill";
        if (highlight && highlight.name === lvl.name) {
            pill.classList.add("level-pill--active");
        }
        pill.textContent = lvl.threshold ? formatThreshold(lvl.threshold) : "--";
        pills.appendChild(pill);
    });
    container.appendChild(pills);

    const summary = document.createElement("p");
    summary.className = "template-level-popover__summary";
    if (highlight) {
        summary.textContent = `Quantidade em destaque: ${formatThreshold(highlight.threshold)} selos`;
    } else {
        summary.textContent = "Nenhuma quantidade vinculada";
    }
    container.appendChild(summary);
    return container;
}

function pickHighlightLevel(levels, quantity) {
    if (!levels || !levels.length || !quantity || quantity <= 0) {
        return null;
    }
    let candidate = levels[0];
    levels.forEach((lvl) => {
        if (quantity >= lvl.threshold && lvl.threshold >= candidate.threshold) {
            candidate = lvl;
        }
    });
    if (quantity < candidate.threshold) {
        candidate = levels[0];
    }
    return candidate;
}

async function loadTemplates(options = {}) {
    const { all = false, silent = false, page = state.templatePage } = options;
    const loadFullCatalog = all || state.templatePaginationEnabled === false;
    const perfKey = loadFullCatalog ? "templates-all" : "templates-page";
    SEALS_PERF.mark(`${perfKey}-start`);
    setLoading(true);
    try {
        const params = new URLSearchParams({ compact: "1" });
        const serverKey = getCurrentServerKey();
        if (serverKey) params.set("server", serverKey);
        if (loadFullCatalog) {
            params.set("all", "1");
            params.set("pageSize", "500");
        } else {
            params.set("page", String(page || 1));
            params.set("pageSize", String(TEMPLATE_PAGE_SIZE));
            const search = String(state.templateSearch || "").trim();
            const attribute = String(state.attributeFilter || "TODOS").trim().toUpperCase();
            if (search) params.set("search", search);
            if (attribute && attribute !== "TODOS") params.set("attribute", attribute);
        }
        const query = params.toString();
        const payload = takeInitialSealPayload(params)
            || await fetchCachedJson(`/api/seals?${query}`, sealsApiCacheKey(params));
        applyServersPayload(payload);
        state.templates = normalizeSealTemplates(payload.templates);
        state.templateCatalogComplete = !!payload.catalogComplete || loadFullCatalog;
        state.templatePagination = payload.pagination || null;
        if (state.templatePagination) {
            state.templatePage = state.templatePagination.page || state.templatePage;
        }
        sortTemplatesInState();
        renderTemplates();
        renderAttributeStats();
        syncTemplateSelect();
        refreshCalculator();
    } catch (error) {
        if (error.status === 401) {
            state.authLogged = false;
            state.authEmail = "";
            state.templatePaginationEnabled = true;
            state.adminUsers = [];
            clearGoldModalSourceSelection();
            setAuthStatus("Desconectado");
            state.templates = [];
            state.templateCatalogComplete = false;
            state.templatePagination = null;
            renderTemplates();
            return;
        }
        if (!silent) {
            showToast(error.message || "Falha ao carregar selos.", "error");
        }
    } finally {
        setLoading(false);
        SEALS_PERF.mark(`${perfKey}-end`);
        SEALS_PERF.measure(perfKey, `${perfKey}-start`, `${perfKey}-end`);
    }
}

async function ensureTemplateCatalogComplete() {
    if (state.templateCatalogComplete) {
        return;
    }
    if (!state.templateLoadingAll) {
        state.templateLoadingAll = loadTemplates({ all: true, silent: true })
            .finally(() => {
                state.templateLoadingAll = null;
            });
    }
    await state.templateLoadingAll;
    if (!state.templateCatalogComplete) {
        throw new Error("Catalogo completo de selos indisponivel.");
    }
}

async function runCalculatorWithFullCatalog() {
    const requestId = (state.calculatorRequestId || 0) + 1;
    state.calculatorRequestId = requestId;
    if (state.calculatorRequestController) {
        state.calculatorRequestController.abort();
    }
    const requestController = new AbortController();
    state.calculatorRequestController = requestController;
    try {
        await ensureTemplateCatalogComplete();
        const target = parseNumber(state.calculatorTarget);
        const account = getActiveAccount();
        if (target === null || target < 0 || !account) {
            renderCalculatorResults(null);
            return;
        }
        const openerUnitCost = parseGoldInputValue(state.openerPrice, { defaultUnitKey: "M" }) || 0;
        const budget = state.calculatorBudgetMode
            ? parseGoldInputValue(state.calculatorBudget, { defaultUnitKey: "M" }) || 0
            : null;
        const response = await fetch("/api/seals/mobile/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: requestController.signal,
            body: JSON.stringify({
                account,
                serverKey: getCurrentServerKey(),
                attribute: state.calculatorAttribute || (state.attributes[0] || "AT"),
                target,
                strategy: state.calculatorStrategy,
                openersOwned: Math.max(parseInteger(state.openersOwned) || 0, 0),
                openerUnitCost,
                budget,
                blockedTemplateIds: Array.from(getBlockedTemplateSet()),
            }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Nao foi possivel calcular o plano.");
        }
        if (requestId !== state.calculatorRequestId) {
            return;
        }
        const templatesById = new Map(state.templates.map((template) => [Number(template.id), template]));
        const plan = payload.plan || null;
        if (plan) {
            plan.entries = (plan.entries || []).map((entry) => ({
                ...entry,
                template: templatesById.get(Number(entry.id)) || null,
            }));
        }
        state.calculatorPlan = plan;
        renderTemplates();
        renderCalculatorResults(plan);
    } catch (error) {
        if (error?.name === "AbortError") {
            return;
        }
        if (requestId !== state.calculatorRequestId) {
            return;
        }
        showToast(error.message || "Nao foi possivel carregar todos os selos para calcular.", "error");
    }
}

async function loadAccountSeals(account, options = {}) {
    const { allowPreferredRetry = true } = options;
    const targetAccount = account || "";
    if (!state.authLogged) {
        resetGuestAccountState();
        return;
    }
    setLoading(true);
    try {
        const params = new URLSearchParams();
        params.set("compact", "1");
        if (targetAccount) params.set("account", targetAccount);
        const serverKey = getCurrentServerKey();
        if (serverKey) params.set("server", serverKey);
        const query = params.toString() ? `?${params.toString()}` : "";
        const response = await fetch(`/api/account-seals${query}`);
        const payload = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                state.authLogged = false;
                state.authEmail = "";
                state.displayName = "";
                state.avatarUrl = "";
                state.impersonating = false;
                state.isAdmin = false;
                state.adminUsers = [];
                clearGoldModalSourceSelection();
                setAuthStatus("Desconectado");
                resetGuestAccountState();
                return;
            }
            throw new Error(payload.error || "Erro ao carregar My Seals.");
        }
        const availableAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        const resolvedAccount = payload.account || targetAccount || availableAccounts[0] || "";
        const preferredAccount = loadStoredAccountPreference({ fallbackToLast: true, apply: false });
        if (
            allowPreferredRetry &&
            preferredAccount &&
            preferredAccount !== resolvedAccount &&
            availableAccounts.includes(preferredAccount)
        ) {
            await loadAccountSeals(preferredAccount, { allowPreferredRetry: false });
            return;
        }
        state.accounts = availableAccounts;
        state.account = resolvedAccount;
        state.mySeals = Array.isArray(payload.seals) ? payload.seals.map(normalizeAccountSealEntry) : [];
        state.personalSealPrices = payload.prices && typeof payload.prices === "object" ? payload.prices : {};
        state.blockedTemplates = Array.isArray(payload.blockedTemplateIds) ? payload.blockedTemplateIds : [];
        state.accountsLoaded = true;
        if (state.account) {
            saveAccountPreference(state.account);
        } else {
            clearStoredAccountPreference();
        }
        loadScopedCalculatorPreferences();
        sortAccountSeals();
        syncAccountControls();
        updateProfileSummary();
        renderAccountSeals();
        renderTemplates();
        refreshCalculator();
    } catch (error) {
        showToast(error.message || "Falha ao carregar os My Seals.", "error");
        state.accountsLoaded = false;
    } finally {
        setLoading(false);
    }
}

async function handleExportMySealsPdf() {
    if (APP_CONFIG.staticMode) {
        const account = state.account || getActiveAccount();
        if (!account) {
            showToast("Selecione ou crie um perfil de jogo antes de exportar.", "warning");
            return;
        }
        try {
            const seals = state.mySeals.filter((entry) => Number(entry.quantity) > 0)
                .sort((a, b) => compareTemplateOrder(a.template, b.template));
            const totalQuantity = seals.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
            const totalGold = seals.reduce((sum, entry) => sum + Number(entry.quantity || 0) * Number(getAccountUnitCost(entry, entry.template || {}) || 0), 0);
            const gold = (value) => formatGoldText(formatGoldDisplay(value, { zeroAsValue: true }));
            const entries = seals.map((entry) => {
                const seal = entry.template || {};
                const unit = Number(getAccountUnitCost(entry, seal) || 0);
                return {
                    name: seal.name || "Selo",
                    attribute: seal.attribute || "--",
                    quantity: formatThreshold(entry.quantity),
                    level: entry.currentLevel?.name || "--",
                    bonus: formatAttributeValue(seal.attribute, getEntryCurrentValue(entry)),
                    unitGold: gold(unit),
                    totalGold: gold(unit * Number(entry.quantity || 0)),
                };
            });
            const bytes = window.SealsPdf.createPdf(entries, {
                account,
                server: getCurrentServerLabel(),
                date: new Date().toLocaleString("pt-BR"),
                count: seals.length,
                quantity: formatThreshold(totalQuantity),
                gold: gold(totalGold),
            });
            const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `meus-selos-${formatPdfFilenamePart(account, "perfil")}-${getCurrentServerKey()}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast("PDF de Meus Selos gerado.", "success");
        } catch (error) {
            showToast(error.message || "Falha ao gerar PDF de Meus Selos.", "error");
        }
        return;
    }
    if (!state.authLogged) {
        showToast("Fa\xC3\xA7a login para exportar seus My Seals.", "warning");
        return;
    }
    const account = state.account || getActiveAccount();
    if (!account) {
        showToast("Selecione ou crie um perfil de jogo antes de exportar.", "warning");
        return;
    }
    try {
        const params = new URLSearchParams({ account });
        const serverKey = getCurrentServerKey();
        if (serverKey) params.set("server", serverKey);
        const response = await fetch(`/api/account-seals/export-pdf?${params.toString()}`);
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "Erro ao gerar PDF.");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `my-seals-${account}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast("PDF gerado com sucesso.", "success");
    } catch (error) {
        showToast(error.message || "Falha ao gerar PDF.", "error");
    }
}

function buildCalculatorPdfPayload(plan) {
    return {
        account: getActiveAccount() || "",
        serverLabel: getCurrentServerLabel(),
        attribute: plan.attribute,
        target: plan.target,
        currentTotal: plan.currentTotal,
        projectedTotal: plan.projectedTotal,
        missingAfterPlan: plan.missingAfterPlan,
        totalSeals: plan.totalSeals,
        totalOpeners: plan.totalOpeners,
        openersOwnedUsed: plan.openersOwnedUsed,
        openersToBuy: plan.openersToBuy,
        openerGoldNeeded: plan.openerGoldNeeded,
        totalGold: plan.totalGold,
        totalGoldWithOpeners: plan.totalGoldWithOpeners,
        budgetMode: plan.budgetMode,
        budget: plan.budget,
        budgetRemaining: plan.budgetRemaining,
        strategyLabel: plan.strategyLabel,
        strategyNotice: plan.strategyNotice,
        entries: (plan.entries || []).map((entry) => ({
            id: entry.id,
            orderIndex: entry.template?.orderIndex ?? 0,
            name: entry.name,
            attribute: entry.attribute,
            currentQuantity: entry.currentQuantity,
            targetQuantity: entry.targetQuantity,
            sealsNeeded: entry.sealsNeeded,
            openersNeeded: entry.openersNeeded,
            currentValue: entry.currentValue,
            projectedValue: entry.projectedValue,
            gain: entry.gain,
            unitCost: entry.unitCost,
            goldNeeded: entry.goldNeeded,
        })),
    };
}

async function handleExportCalculatorPdf(plan = state.calculatorPlan) {
    if (APP_CONFIG.staticMode) {
        if (!plan || !Array.isArray(plan.entries) || !plan.entries.length) {
            showToast("Calcule um plano com selos antes de exportar.", "warning");
            return;
        }
        try {
            const gold = (value) => formatGoldText(formatGoldDisplay(value, { zeroAsValue: true }));
            const entries = plan.entries.map((entry) => ({
                name: entry.name || entry.template?.name || "Selo",
                attribute: entry.attribute || plan.attribute || "--",
                needed: formatThreshold(entry.sealsNeeded),
                current: formatThreshold(entry.currentQuantity),
                target: formatThreshold(entry.targetQuantity),
                gain: formatAttributeValue(entry.attribute || plan.attribute, entry.gain),
                openers: formatThreshold(entry.openersNeeded),
                unitGold: gold(entry.unitCost),
                totalGold: gold(entry.goldNeeded),
            }));
            const account = getActiveAccount() || "Perfil";
            const bytes = window.SealsPdf.createPdf(entries, {
                kind: "plan",
                account,
                server: getCurrentServerLabel(),
                date: new Date().toLocaleString("pt-BR"),
                count: entries.length,
                quantity: formatThreshold(plan.totalSeals),
                gold: gold(plan.totalGoldWithOpeners),
            });
            const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `plano-selos-${formatPdfFilenamePart(account, "perfil")}-${formatPdfFilenamePart(plan.attribute, "status")}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast("PDF do plano gerado.", "success");
        } catch (error) {
            showToast(error.message || "Falha ao gerar PDF do plano.", "error");
        }
        return;
    }
    if (!state.authLogged) {
        showToast("Faca login para exportar o plano da calculadora.", "warning");
        return;
    }
    if (!plan || !Array.isArray(plan.entries) || !plan.entries.length) {
        showToast("Calcule um plano com itens antes de exportar.", "warning");
        return;
    }
    try {
        const response = await fetch("/api/seals/calculator/export-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildCalculatorPdfPayload(plan)),
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "Erro ao gerar PDF do plano.");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        const account = formatPdfFilenamePart(getActiveAccount(), "perfil");
        const attribute = formatPdfFilenamePart(plan.attribute || "status", "status");
        link.href = url;
        link.download = `plano-selos-${account}-${attribute}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast("PDF do plano gerado com sucesso.", "success");
    } catch (error) {
        showToast(error.message || "Falha ao gerar PDF do plano.", "error");
    }
}

function renderTemplates() {
    if (!elements.templateList) {
        return;
    }
    elements.templateList.classList.toggle("seals-grid--simple", state.simpleSealCards);
    const serverPaged = !state.templateCatalogComplete && !!state.templatePagination;
    const search = state.templateSearch.toLowerCase();
    const currentFilter = (state.attributeFilter || "TODOS").toUpperCase();
    const activeAccount = getActiveAccount();
    const filtered = state.templates.filter((template) => {
        if (!serverPaged) {
            const attr = normalizeAttributeKey(template.attribute);
            const attributeMatch = currentFilter === "TODOS" || attr === currentFilter;
            if (!attributeMatch) {
                return false;
            }
        }
        if (state.hideMaxedSeals) {
            const accountSeal = getAccountSealForTemplate(template, activeAccount);
            if (isSealAtMax(template, accountSeal ? accountSeal.quantity : 0)) {
                return false;
            }
        }
        if (serverPaged || !search) {
            return true;
        }
        const target = `${template.name} ${template.attribute}`.toLowerCase();
        return target.includes(search);
    });

    const serverTotal = parseInteger(state.templatePagination?.totalItems ?? state.templatePagination?.total) || 0;
    const totalTemplates = serverPaged && !state.hideMaxedSeals ? serverTotal : filtered.length;
    if (elements.templateStats) {
        const label = totalTemplates === 1 ? "Selo" : "Selos";
        elements.templateStats.textContent = `Número de Selos (${totalTemplates} ${label})`;
    }

    if (!filtered.length) {
        elements.templateList.classList.add("empty-state");
        elements.templateList.textContent = state.hideMaxedSeals
            ? "Nenhum template visivel. Os selos no nivel maximo estao ocultos."
            : "Nenhum template encontrado.";
        renderListPagination(elements.templatePager, null, () => {});
        return;
    }
    elements.templateList.classList.remove("empty-state");
    elements.templateList.innerHTML = "";

    const ordered = filtered.slice().sort(compareTemplateOrder);
    const usePagination = serverPaged || state.templatePaginationEnabled !== false || ordered.length > TEMPLATE_PAGE_SIZE * 2;
    const pagination = serverPaged
        ? {
            items: ordered,
            totalItems: serverTotal,
            totalPages: state.templatePagination.totalPages || 1,
            currentPage: state.templatePagination.currentPage || state.templatePagination.page || state.templatePage || 1,
            startIndex: state.templatePagination.startIndex || 0,
            endIndex: state.templatePagination.endIndex || ordered.length,
        }
        : (usePagination ? paginateItems(ordered, state.templatePage, TEMPLATE_PAGE_SIZE) : null);
    const visibleTemplates = pagination ? pagination.items : ordered;
    state.templatePage = pagination ? pagination.currentPage : 1;
    visibleTemplates.forEach((template) => {
        const accountSeal = getAccountSealForTemplate(template, activeAccount);
        const accountQuantity = accountSeal ? accountSeal.quantity : 0;
        const card = document.createElement("div");
        card.className = `seal-card seal-card--template${state.simpleSealCards ? " seal-card--simple" : ""}`;
        card.dataset.templateId = String(template.id);
        applyMaxedSealState(card, template, accountQuantity);

        const header = document.createElement("div");
        header.className = "seal-card__header";
        const title = document.createElement("h3");
        title.textContent = template.name;
        const meta = document.createElement("div");
        meta.className = "seal-card__meta";
        const badge = document.createElement("span");
        badge.className = "attribute-badge";
        badge.dataset.attribute = normalizeAttributeKey(template.attribute);
        badge.textContent = template.attribute;
        const base = document.createElement("span");
        base.className = "base-value";
        base.textContent = `Valor max.: ${formatAttributeValue(template.attribute, template.baseValue)}`;
        meta.appendChild(badge);
        meta.appendChild(base);
        header.appendChild(title);
        header.appendChild(meta);
        card.appendChild(header);

        if (state.isAdmin && !state.simpleSealCards) {
            const actions = document.createElement("div");
            actions.className = "seal-card__actions";
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "ghost-btn ghost-btn--sm";
            editBtn.textContent = "Editar";
            editBtn.addEventListener("click", () => openSealModal(template));
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "ghost-btn ghost-btn--danger ghost-btn--sm";
            deleteBtn.textContent = "X";
            deleteBtn.addEventListener("click", () => handleTemplateDelete(template));
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            card.appendChild(actions);
        }

        const accountRow = document.createElement("div");
        accountRow.className = "template-account-row";
        const accountLabel = document.createElement("span");
        accountLabel.className = "template-account-row__label";
        accountLabel.textContent = activeAccount ? `Perfil de jogo: ${activeAccount}` : "Selecione um perfil de jogo";
        const accountValue = document.createElement("span");
        accountValue.className = "template-account-row__value";
        const qtyText = accountSeal ? formatThreshold(accountSeal.quantity) : "0";
        accountValue.textContent = `${qtyText} selos`;
        if (activeAccount) {
            accountValue.classList.add("template-account-row__value--action");
            accountValue.addEventListener("click", () => {
                const existingInput = accountValue.querySelector("input.inline-quantity-input");
                if (existingInput) {
                    existingInput.focus();
                    existingInput.select();
                    return;
                }
                const entry = state.mySeals.find(
                    (item) => item.sealId === template.id && item.account === activeAccount,
                );
                const current = entry ? entry.quantity || 0 : 0;
                const previousLabel = `${formatThreshold(current)} selos`;
                const input = document.createElement("input");
                input.type = "number";
                input.min = "0";
                input.step = "1";
                input.value = "";
                input.placeholder = formatThreshold(current);
                input.className = "inline-quantity-input";
                accountValue.dataset.editing = "true";
                accountValue.replaceChildren(input);
                input.focus();
                input.select();

                let hasChanged = false;
                let finished = false;
                input.addEventListener("input", () => {
                    hasChanged = true;
                });

                const finish = async (newValue, shouldSave) => {
                    if (finished) return;
                    finished = true;
                    delete accountValue.dataset.editing;

                    const rawValue = typeof newValue === "string" ? newValue.trim() : "";
                    if (!shouldSave || !hasChanged || rawValue === "") {
                        accountValue.textContent = previousLabel;
                        return;
                    }

                    const parsed = parseInteger(rawValue);
                    if (parsed === null || parsed < 0) {
                        showToast("Quantidade invalida.", "warning");
                        accountValue.textContent = previousLabel;
                        return;
                    }
                    if (parsed === current) {
                        accountValue.textContent = previousLabel;
                        return;
                    }

                    const { value: safeQty, capped, max } = clampQuantityToMax(template, parsed);
                    if (safeQty === null || safeQty < 0) {
                        showToast("Quantidade invalida.", "warning");
                        accountValue.textContent = previousLabel;
                        return;
                    }

                    if (capped) {
                        showToast("Limite maximo do selo alcan?ado (100%). Ajustamos a quantidade.", "warning");
                    }

                    try {
                        if (entry) {
                            await updateAccountSeal(
                                entry.id,
                                safeQty,
                                activeAccount,
                                getAccountUnitCost(entry, template) ?? null,
                            );
                        } else if (safeQty > 0 || capped) {
                            const response = await fetch("/api/account-seals", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    account: activeAccount,
                                    sealId: template.id,
                                    quantity: safeQty,
                                    unitCost: getTemplateUnitCost(template) ?? null,
                                    serverKey: getCurrentServerKey(),
                                }),
                            });
                            const payload = await response.json();

                            if (!response.ok) {
                                throw new Error(payload.error || "Erro ao salvar o My Seal.");
                            }
                        }

                        await loadAccountSeals(activeAccount);
                    } catch (err) {
                        showToast(err.message || "Erro ao atualizar quantidade.", "error");
                        accountValue.textContent = previousLabel;
                    }
                };

                input.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") {
                        ev.preventDefault();
                        finish(input.value, true);
                    } else if (ev.key === "Escape") {
                        ev.preventDefault();
                        finish(input.value, false);
                    }
                });
                input.addEventListener("blur", () => finish(input.value, true));
            });
        }
        accountRow.appendChild(accountLabel);
        accountRow.appendChild(accountValue);
        card.appendChild(accountRow);
        const currentServer = getCurrentServerKey();
        const serverLabel = getCurrentServerLabel();
        const effectiveUnitCost = getAccountUnitCost(accountSeal, template, currentServer) || 0;
        const costDisplay = formatGoldDisplay(effectiveUnitCost);
        const costRow = document.createElement("div");
        costRow.className = "seal-card__currency";
        const iconUrl = getCurrencyIconUrl(costDisplay.icon);
        if (iconUrl) {
            const icon = document.createElement("img");
            icon.className = "currency-icon";
            icon.alt = costDisplay.unit || "";
            prepareIconImage(icon);
            icon.src = iconUrl;
            costRow.appendChild(icon);
        }
        const costLabel = document.createElement("span");
        costLabel.className = "seal-card__currency-label";
        costLabel.textContent = `Gold (${serverLabel})`;
        const costValue = document.createElement("span");
        costValue.className = "currency-text";
        costValue.textContent = formatGoldText(costDisplay);
        costRow.appendChild(costLabel);
        costRow.appendChild(costValue);
        costRow.classList.add("seal-card__currency", "seal-card__currency--clickable");
        costRow.addEventListener("click", () => openGoldModal(template));
        card.appendChild(costRow);

        if (!state.simpleSealCards) window.SealCardDate?.append(card, template.createdAt, "catálogo");

        attachTemplateDrag(card, template);
        elements.templateList.appendChild(card);
    });

    if (usePagination) {
        renderListPagination(elements.templatePager, pagination, (nextPage) => {
            state.templatePage = nextPage;
            if (serverPaged) {
                loadTemplates({ page: nextPage });
                return;
            }
            renderTemplates();
        });
    } else {
        renderListPagination(elements.templatePager, null, () => {});
    }
}

function setAuthStatus(text) {
    if (elements.authStatus) {
        const statusText = state.authLogged ? "Conectado" : text || "Desconectado";
        elements.authStatus.textContent = statusText;
    }
    if (elements.authActionBtn) {
        elements.authActionBtn.textContent = state.authLogged ? "Sair" : "Entrar";
    }
    if (elements.userPanelLogged) {
        elements.userPanelLogged.classList.toggle("hidden", !state.authLogged);
    }
    if (elements.exportMySealsPdfBtn) {
        elements.exportMySealsPdfBtn.classList.toggle("hidden", !state.authLogged);
    }
    if (elements.openLoginPanel) {
        elements.openLoginPanel.classList.toggle("hidden", state.authLogged);
    }
    if (elements.loginForm && state.authLogged) {
        elements.loginForm.classList.add("hidden");
    }
    if (elements.registerForm) {
        elements.registerForm.classList.add("hidden");
    }
    if (elements.openProfileBtn) {
        elements.openProfileBtn.classList.toggle("hidden", !state.authLogged);
        elements.openProfileBtn.setAttribute("aria-disabled", String(!state.authLogged));
    }
    if (elements.authActionBtn) {
        elements.authActionBtn.disabled = false;
    }
    updateAdminControls();
    updateAvatarDisplay();
}

function updateAdminControls() {
    const isAdmin = state.authLogged && (state.isAdmin || state.authEmail.toLowerCase() === state.adminEmail);
    state.isAdmin = isAdmin;
    if (elements.openSealModalBtn) {
        elements.openSealModalBtn.classList.toggle("hidden", !isAdmin);
    }
    if (elements.templateAdminActions) {
        elements.templateAdminActions.classList.toggle("hidden", !isAdmin);
    }
    if (elements.goldModalSyncBtn) {
        elements.goldModalSyncBtn.classList.toggle("hidden", !isAdmin);
        elements.goldModalSyncBtn.disabled = true;
    }
    if (elements.goldModalSyncAllBtn) {
        elements.goldModalSyncAllBtn.classList.toggle("hidden", !isAdmin);
        elements.goldModalSyncAllBtn.disabled = true;
    }
    if (elements.goldModalAdminSource) {
        elements.goldModalAdminSource.classList.toggle("hidden", !isAdmin);
        if (!isAdmin) {
            clearGoldModalSourceSelection();
            if (elements.goldModalSourceUserInput) {
                elements.goldModalSourceUserInput.value = "";
            }
        }
    }
    if (elements.adminPanel) {
        elements.adminPanel.classList.toggle("hidden", !isAdmin);
        if (!isAdmin) {
            elements.adminPanel.classList.remove("is-open", "is-collapsed");
        }
    }
    if (elements.adminPanelToggle) {
        elements.adminPanelToggle.classList.toggle("hidden", !isAdmin);
    }
    if (elements.adminBlock) {
        elements.adminBlock.classList.toggle("hidden", !isAdmin);
    }
    if (elements.stopImpersonateBtn) {
        elements.stopImpersonateBtn.classList.toggle("hidden", !state.impersonating);
    }
    renderServerAdminList();
    scheduleFloatingPanelsSync();
    updateGoldModalSyncButtonState();
}

async function loadAuthStatus(options = {}) {
    const { loadAccounts = true } = options;
    try {
        const { response, payload } = await window.AppCore.getMe();
        if (!response.ok) {
            state.authLogged = false;
            state.authEmail = "";
            state.displayName = "";
            state.avatarUrl = "";
            state.templatePaginationEnabled = true;
            state.adminUsers = [];
            clearGoldModalSourceSelection();
            state.accountsLoaded = false;
            state.openerPrice = "";
            setAuthStatus("Desconectado");
            resetGuestAccountState();
            return;
        }
        state.authEmail = payload.email || "";
        state.displayName = payload.displayName || "";
        state.avatarUrl = payload.avatarUrl || "";
        const previousTemplatePaginationEnabled = state.templatePaginationEnabled;
        state.templatePaginationEnabled = payload.sealTemplatePaginationEnabled !== false;
        state.impersonating = !!payload.impersonating;
        state.isAdmin = !!payload.isAdmin || state.authEmail.toLowerCase() === state.adminEmail;
        if (payload.theme) {
            state.theme = payload.theme;
            applyTheme(state.theme);
        }
        const previousAccount = state.account;
        loadStoredAccountPreference({ fallbackToLast: true });
        loadStoredServerPreference();
        loadScopedCalculatorPreferences();
        updateAvatarDisplay();
        state.authLogged = true;
        setAuthStatus("Conectado");
        updateProfileSummary();
        if (previousTemplatePaginationEnabled !== state.templatePaginationEnabled) {
            state.templatePage = 1;
            if (state.templatePaginationEnabled === false && !state.templateCatalogComplete) {
                await loadTemplates({ all: true, silent: true });
            } else {
                renderTemplates();
            }
        }
        renderServerTabs();
        renderServerAdminList();
        if (loadAccounts) {
            const preferredAccount = getActiveAccount();
            if (!state.accountsLoaded || (preferredAccount && preferredAccount !== previousAccount)) {
                await loadAccountSeals(preferredAccount);
            }
        }
    } catch (error) {
        state.authLogged = false;
        state.authEmail = "";
        state.displayName = "";
        state.avatarUrl = "";
        state.templatePaginationEnabled = true;
        state.impersonating = false;
        state.isAdmin = false;
        state.adminUsers = [];
        clearGoldModalSourceSelection();
        state.accountsLoaded = false;
        state.openerPrice = "";
        setAuthStatus("Desconectado");
        resetGuestAccountState();
        loadStoredServerPreference();
        renderServerTabs();
        renderServerAdminList();
    }
    toggleAuthForms("login");
}

async function handleAuthAction() {
    if (state.authLogged) {
        try {
            const { response, payload } = await window.AppCore.logout();
            if (!response.ok) {
                throw new Error(payload.error || "Falha ao sair.");
            }
            showToast("Sessao encerrada.");
            state.authLogged = false;
            state.authEmail = "";
            state.templatePaginationEnabled = true;
            state.adminUsers = [];
            clearGoldModalSourceSelection();
            setAuthStatus("Desconectado");
            toggleAuthForms("login");
            resetGuestAccountState();
            loadStoredServerPreference();
            renderServerTabs();
            renderServerAdminList();
        } catch (error) {
            showToast(error.message || "Nao foi possivel sair.", "error");
        }
        return;
    }
    toggleAuthForms("login");
}

function toggleAuthForms(mode) {
    if (state.authLogged) {
        if (elements.loginForm) elements.loginForm.classList.add("hidden");
        if (elements.registerForm) elements.registerForm.classList.add("hidden");
        return;
    }
    const showLogin = mode === "login";
    if (elements.loginForm) {
        elements.loginForm.classList.toggle("hidden", !showLogin);
    }
    if (elements.registerForm) {
        elements.registerForm.classList.toggle("hidden", showLogin);
    }
}

async function handleAddAdmin() {
    const email = (elements.adminEmailInput?.value || "").trim().toLowerCase();
    if (!email) {
        showToast("Informe o email do admin.", "warning");
        return;
    }
    try {
        const response = await fetch("/api/admin/admins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao adicionar admin.");
        }
        showToast(payload.message || "Admin adicionado.");
        elements.adminEmailInput.value = "";
    } catch (error) {
        showToast(error.message || "Erro ao adicionar admin.", "error");
    }
}

async function handleAddServer() {
    if (!state.isAdmin) {
        showToast("Apenas admins podem adicionar servidores.", "warning");
        return;
    }
    const key = (elements.serverKeyInput?.value || "").trim();
    const label = (elements.serverLabelInput?.value || "").trim();
    if (!key && !label) {
        showToast("Informe a chave ou nome do servidor.", "warning");
        return;
    }
    try {
        const response = await fetch("/api/admin/servers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, label }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao adicionar servidor.");
        }
        applyServersPayload(payload);
        saveServerPreference();
        showToast(payload.message || "Servidor adicionado.");
        if (elements.serverKeyInput) elements.serverKeyInput.value = "";
        if (elements.serverLabelInput) elements.serverLabelInput.value = "";
    } catch (error) {
        showToast(error.message || "Erro ao adicionar servidor.", "error");
    }
}

async function handleDeleteServer(serverKey) {
    if (!state.isAdmin) {
        showToast("Apenas admins podem remover servidores.", "warning");
        return;
    }
    if (!serverKey) return;
    const confirmed = window.confirm(`Remover o servidor "${serverKey}"?`);
    if (!confirmed) return;
    try {
        const response = await fetch(`/api/admin/servers/${encodeURIComponent(serverKey)}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao remover servidor.");
        }
        applyServersPayload(payload);
        saveServerPreference();
        showToast(payload.message || "Servidor removido.");
    } catch (error) {
        showToast(error.message || "Erro ao remover servidor.", "error");
    }
}

async function handleDownloadDb() {
    if (!state.isAdmin) {
        showToast("Apenas admins podem baixar o banco.", "warning");
        return;
    }
    try {
        const response = await fetch("/api/admin/database");
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "Falha ao baixar banco.");
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "digimon.db";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast("Banco baixado com sucesso.");
    } catch (error) {
        showToast(error.message || "Erro ao baixar banco.", "error");
    }
}

async function handleImportDb(file) {
    if (!state.isAdmin) {
        showToast("Apenas admins podem importar banco.", "warning");
        return;
    }
    const targetFile = file || (elements.importDbInput?.files?.[0] || null);
    if (!targetFile) {
        showToast("Selecione um arquivo .db para importar.", "warning");
        return;
    }
    const form = new FormData();
    form.append("file", targetFile);
    try {
        const response = await fetch("/api/admin/database", {
            method: "POST",
            body: form,
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao importar banco.");
        }
        showToast(payload.message || "Banco importado. Recarregando...");
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showToast(error.message || "Erro ao importar banco.", "error");
    }
}

async function handleImportLegacyExcels() {
    if (!state.isAdmin) {
        showToast("Apenas admins podem importar planilhas legadas.", "warning");
        return;
    }
    const confirmed = window.confirm(
        "Importar Tamer.xlsx e Digimons.xlsx das pastas locais para o usuario atual/impersonado?"
    );
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch("/api/admin/import-legacy-excels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao importar planilhas legadas.");
        }
        const importedCount = Array.isArray(payload.importedAccounts) ? payload.importedAccounts.length : 0;
        showToast(payload.message || `Importacao concluida para ${importedCount} perfil(is) de jogo.`);
        if (Array.isArray(payload.accounts) && payload.accounts.length) {
            state.accounts = payload.accounts;
            state.accountsLoaded = false;
            if (!state.account || !state.accounts.includes(state.account)) {
                state.account = state.accounts[0];
            }
            syncAccountControls();
            await loadTemplates();
            await loadAccountSeals(state.account);
        }
        if (Array.isArray(payload.errors) && payload.errors.length) {
            payload.errors.forEach((message) => showToast(message, "warning"));
        }
    } catch (error) {
        showToast(error.message || "Erro ao importar planilhas legadas.", "error");
    }
}

function findAdminUserByEmail(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
        return null;
    }
    return (
        (state.adminUsers || []).find(
            (user) => String(user.email || "").trim().toLowerCase() === normalizedEmail,
        ) || null
    );
}

function getGoldModalSourceUserValue() {
    return (elements.goldModalSourceUserInput?.value || "").trim();
}

function getGoldModalSourceAccountValue() {
    return (elements.goldModalSourceAccountInput?.value || "").trim();
}

function getGoldModalSelectedSourceUser() {
    return findAdminUserByEmail(getGoldModalSourceUserValue());
}

function renderGoldModalSourceUserOptions() {
    if (!elements.goldModalSourceUserOptions) {
        return;
    }
    elements.goldModalSourceUserOptions.innerHTML = "";
    (state.adminUsers || []).forEach((user) => {
        const option = document.createElement("option");
        option.value = user.email || "";
        option.label = user.displayName || user.email || "";
        option.textContent = user.displayName || user.email || "";
        elements.goldModalSourceUserOptions.appendChild(option);
    });
}

function renderGoldModalSourceAccountOptions() {
    if (!elements.goldModalSourceAccountOptions) {
        return;
    }
    elements.goldModalSourceAccountOptions.innerHTML = "";
    (state.goldModalSourceAccounts || []).forEach((account) => {
        const option = document.createElement("option");
        option.value = account;
        elements.goldModalSourceAccountOptions.appendChild(option);
    });
}

function clearGoldModalSourceSelection() {
    state.goldModalSourceUserId = null;
    state.goldModalSourceAccounts = [];
    if (elements.goldModalSourceAccountInput) {
        elements.goldModalSourceAccountInput.value = "";
    }
    renderGoldModalSourceAccountOptions();
}

function updateGoldModalSyncButtonState() {
    if (!elements.goldModalSyncBtn && !elements.goldModalSyncAllBtn) {
        return;
    }
    const isAdmin = !!state.isAdmin;
    if (elements.goldModalSyncBtn) {
        elements.goldModalSyncBtn.classList.toggle("hidden", !isAdmin);
    }
    if (elements.goldModalSyncAllBtn) {
        elements.goldModalSyncAllBtn.classList.toggle("hidden", !isAdmin);
    }
    if (!isAdmin) {
        return;
    }
    const sourceUserValue = getGoldModalSourceUserValue();
    const selectedSourceUser = getGoldModalSelectedSourceUser();
    const selectedSourceAccount = getGoldModalSourceAccountValue();
    if (sourceUserValue) {
        if (!selectedSourceUser) {
            if (elements.goldModalSyncBtn) {
                elements.goldModalSyncBtn.disabled = true;
                elements.goldModalSyncBtn.textContent = "Selecione um usuario valido";
            }
            if (elements.goldModalSyncAllBtn) {
                elements.goldModalSyncAllBtn.disabled = true;
                elements.goldModalSyncAllBtn.textContent = "Puxar todos do usuario";
            }
            return;
        }
        if (elements.goldModalSyncAllBtn) {
            elements.goldModalSyncAllBtn.disabled = false;
            elements.goldModalSyncAllBtn.textContent = `Puxar todos de ${selectedSourceUser.email}`;
        }
        if (!selectedSourceAccount) {
            if (elements.goldModalSyncBtn) {
                elements.goldModalSyncBtn.disabled = true;
                elements.goldModalSyncBtn.textContent = `Selecione o perfil de jogo de ${selectedSourceUser.email}`;
            }
            return;
        }
        if (elements.goldModalSyncBtn) {
            elements.goldModalSyncBtn.disabled = false;
            elements.goldModalSyncBtn.textContent = `Puxar de ${selectedSourceUser.email} (${selectedSourceAccount})`;
        }
        return;
    }
    const activeAccount = getActiveAccount();
    const canSync =
        !!state.goldModalAccountSeal &&
        state.goldModalAccountSeal.unitCost !== undefined &&
        state.goldModalAccountSeal.unitCost !== null;
    if (elements.goldModalSyncBtn) {
        elements.goldModalSyncBtn.disabled = !canSync;
        elements.goldModalSyncBtn.textContent = canSync
            ? `Usar meu gold (${activeAccount}) no global`
            : "Usar meu gold no global";
    }
    if (elements.goldModalSyncAllBtn) {
        elements.goldModalSyncAllBtn.disabled = true;
        elements.goldModalSyncAllBtn.textContent = "Puxar todos do usuario";
    }
}

async function ensureAdminUsersLoaded(options = {}) {
    const { force = false } = options;
    if (!state.isAdmin) {
        return [];
    }
    if (!force && Array.isArray(state.adminUsers) && state.adminUsers.length) {
        renderGoldModalSourceUserOptions();
        return state.adminUsers;
    }
    const response = await fetch("/api/admin/users");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || "Falha ao carregar usuarios.");
    }
    state.adminUsers = Array.isArray(payload.users) ? payload.users : [];
    renderGoldModalSourceUserOptions();
    return state.adminUsers;
}

async function loadGoldModalSourceAccounts(userId) {
    if (!state.isAdmin || !userId) {
        clearGoldModalSourceSelection();
        updateGoldModalSyncButtonState();
        return [];
    }
    const response = await fetch(`/api/admin/users/${userId}/accounts`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || "Falha ao carregar perfis de jogo do usuario.");
    }
    const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
    state.goldModalSourceUserId = userId;
    state.goldModalSourceAccounts = accounts;
    renderGoldModalSourceAccountOptions();
    if (elements.goldModalSourceAccountInput) {
        const currentValue = elements.goldModalSourceAccountInput.value.trim();
        if (!currentValue || !accounts.includes(currentValue)) {
            elements.goldModalSourceAccountInput.value = accounts[0] || "";
        }
    }
    updateGoldModalSyncButtonState();
    return accounts;
}

async function handleGoldModalSourceUserChange() {
    const sourceUserValue = getGoldModalSourceUserValue();
    if (!sourceUserValue) {
        clearGoldModalSourceSelection();
        updateGoldModalSyncButtonState();
        return;
    }
    try {
        await ensureAdminUsersLoaded();
        const user = getGoldModalSelectedSourceUser();
        if (!user) {
            clearGoldModalSourceSelection();
            updateGoldModalSyncButtonState();
            return;
        }
        if (state.goldModalSourceUserId === user.id && state.goldModalSourceAccounts.length) {
            updateGoldModalSyncButtonState();
            return;
        }
        await loadGoldModalSourceAccounts(user.id);
    } catch (error) {
        clearGoldModalSourceSelection();
        updateGoldModalSyncButtonState();
        showToast(error.message || "Nao foi possivel carregar os perfis de jogo do usuario.", "error");
    }
}

async function openUserListModal() {
    if (!state.isAdmin) return;
    try {
        const users = await ensureAdminUsersLoaded({ force: true });
        renderUserList(users || []);
        if (elements.userListModal) {
            elements.userListModal.classList.remove("hidden");
            elements.userListModal.setAttribute("aria-hidden", "false");
        }
    } catch (error) {
        showToast(error.message || "NÃ£o foi possÃ­vel listar usuÃ¡rios.", "error");
    }
}

function closeUserListModal() {
    if (!elements.userListModal) return;
    elements.userListModal.classList.add("hidden");
    elements.userListModal.setAttribute("aria-hidden", "true");
}

function renderUserList(users) {
    if (!elements.userListBody) return;
    if (!users.length) {
        elements.userListBody.textContent = "Nenhum usuÃ¡rio encontrado.";
        return;
    }
    elements.userListBody.innerHTML = "";
    users.forEach((user) => {
        const card = document.createElement("div");
        card.className = "admin-user-card";
        const info = document.createElement("div");
        info.className = "admin-user-card__info";
        const name = document.createElement("strong");
        name.textContent = user.displayName || user.email;
        const email = document.createElement("span");
        email.textContent = user.email;
        const meta = document.createElement("span");
        meta.textContent = `Perfis de jogo: ${user.accounts || 0}`;
        info.appendChild(name);
        info.appendChild(email);
        info.appendChild(meta);
        const actions = document.createElement("div");
        actions.className = "admin-user-card__actions";
        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "ghost-btn";
        viewBtn.textContent = "Visualizar";
        viewBtn.addEventListener("click", () => startImpersonation(user.id));
        actions.appendChild(viewBtn);
        card.appendChild(info);
        card.appendChild(actions);
        elements.userListBody.appendChild(card);
    });
}

async function startImpersonation(userId) {
    try {
        const response = await fetch("/api/admin/impersonate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao entrar em modo visualizar.");
        }
        showToast(payload.message || "Modo visualizar ativado.");
        window.location.reload();
    } catch (error) {
        showToast(error.message || "NÃ£o foi possÃ­vel entrar em modo visualizar.", "error");
    }
}

async function stopImpersonation() {
    try {
        const response = await fetch("/api/admin/impersonate", { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao sair do modo visualizar.");
        }
        showToast(payload.message || "Modo visualizar encerrado.");
        window.location.reload();
    } catch (error) {
        showToast(error.message || "NÃ£o foi possÃ­vel sair do modo visualizar.", "error");
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const email = (elements.loginEmail?.value || "").trim();
    const password = elements.loginPassword?.value || "";
    const remember = !!elements.loginRemember?.checked;
    if (!email || !password) {
        showToast("Informe email e senha.", "warning");
        return;
    }
    try {
        const { response, payload } = await window.AppCore.authenticate("login", email, password, { remember });
        if (!response.ok) {
            if (response.status === 403 && payload.requiresEmailVerification) {
                const shouldResend = window.confirm("Seu e-mail ainda nao foi confirmado. Deseja reenviar o link de confirmacao?");
                if (shouldResend) {
                    const resendResult = await window.AppCore.jsonRequest("/api/email-verification/resend", {
                        method: "POST",
                        body: { email },
                    });
                    if (!resendResult.response.ok) {
                        throw new Error(resendResult.payload.error || payload.error || "Falha ao reenviar a verificacao.");
                    }
                    throw new Error(resendResult.payload.message || "Reenviamos o link de confirmacao para o seu e-mail.");
                }
                throw new Error(payload.error || "Confirme seu e-mail antes de entrar.");
            }
            throw new Error(payload.error || "Falha ao autenticar.");
        }
        window.AppCore.persistRememberedAuth(payload.email || email, remember);
        state.authEmail = payload.email || email;
        state.authLogged = true;
        state.displayName = payload.displayName || payload.email || "";
        state.avatarUrl = payload.avatarUrl || state.avatarUrl;
        if (payload.theme) {
            state.theme = payload.theme;
            applyTheme(state.theme);
        }
        setAuthStatus("Conectado");
        showToast("Login realizado com sucesso.");
        await loadAuthStatus({ loadAccounts: false });
        await loadTemplates();
        await loadAccountSeals(state.account);
    } catch (error) {
        showToast(error.message || "Nao foi possivel autenticar.", "error");
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();
    const email = (elements.registerEmail?.value || "").trim();
    const password = elements.registerPassword?.value || "";
    const remember = !!elements.registerRemember?.checked;
    if (!email || !password) {
        showToast("Informe email e senha.", "warning");
        return;
    }
    try {
        if (!state.emailEnabled) {
            throw new Error("Cadastro por e-mail ainda nao esta configurado.");
        }
        const { response, payload } = await window.AppCore.authenticate("register", email, password, { remember });
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao registrar.");
        }
        window.AppCore.persistRememberedAuth(payload.email || email, false);
        state.authEmail = "";
        state.authLogged = false;
        setAuthStatus("Desconectado");
        showToast(payload.message || "Registro realizado. Confira seu e-mail para confirmar a conta.");
        toggleAuthForms("login");
        if (elements.loginEmail) {
            elements.loginEmail.value = payload.email || email;
        }
        if (elements.loginPassword) {
            elements.loginPassword.value = "";
        }
    } catch (error) {
        showToast(error.message || "Nao foi possivel registrar.", "error");
    }
}

function openForgotPasswordModal() {
    if (!elements.forgotPasswordModal) return;
    if (elements.forgotPasswordEmailInput) {
        elements.forgotPasswordEmailInput.value = (elements.loginEmail?.value || elements.registerEmail?.value || "").trim();
    }
    elements.forgotPasswordModal.classList.remove("hidden");
    elements.forgotPasswordModal.setAttribute("aria-hidden", "false");
}

function closeForgotPasswordModal() {
    if (!elements.forgotPasswordModal) return;
    elements.forgotPasswordModal.classList.add("hidden");
    elements.forgotPasswordModal.setAttribute("aria-hidden", "true");
}

async function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    if (!state.emailEnabled) {
        showToast("Envio de e-mail ainda não está configurado.", "warning");
        return;
    }
    const email = (elements.forgotPasswordEmailInput?.value || "").trim();
    if (!email) {
        showToast("Informe o e-mail da conta.", "warning");
        return;
    }
    const submitButton = elements.forgotPasswordForm?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        const { response, payload } = await window.AppCore.jsonRequest("/api/password/forgot", {
            method: "POST",
            body: { email },
        });
        if (!response.ok) {
            throw new Error(payload.error || "Não foi possível solicitar a recuperação.");
        }
        showToast(payload.message || "Verifique seu e-mail para continuar.");
        closeForgotPasswordModal();
    } catch (error) {
        showToast(error.message || "Não foi possível solicitar a recuperação.", "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function openContactModal() {
    if (!elements.contactModal) return;
    if (elements.contactEmailInput && state.authEmail && !elements.contactEmailInput.value.trim()) {
        elements.contactEmailInput.value = state.authEmail;
    }
    if (elements.contactNameInput && state.displayName && !elements.contactNameInput.value.trim()) {
        elements.contactNameInput.value = state.displayName;
    }
    elements.contactModal.classList.remove("hidden");
    elements.contactModal.setAttribute("aria-hidden", "false");
}

function closeContactModal() {
    if (!elements.contactModal) return;
    elements.contactModal.classList.add("hidden");
    elements.contactModal.setAttribute("aria-hidden", "true");
}

async function handleContactSubmit(event) {
    event.preventDefault();
    if (!state.emailEnabled) {
        showToast("Envio de e-mail ainda não está configurado.", "warning");
        return;
    }
    const payload = {
        name: (elements.contactNameInput?.value || "").trim(),
        email: (elements.contactEmailInput?.value || "").trim(),
        subject: (elements.contactSubjectInput?.value || "").trim(),
        message: (elements.contactMessageInput?.value || "").trim(),
    };
    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
        showToast("Preencha todos os campos do contato.", "warning");
        return;
    }
    const submitButton = elements.contactForm?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        const { response, payload: result } = await window.AppCore.jsonRequest("/api/contact", {
            method: "POST",
            body: payload,
        });
        if (!response.ok) {
            throw new Error(result.error || "Não foi possível enviar a mensagem.");
        }
        showToast(result.message || "Mensagem enviada com sucesso.");
        elements.contactForm?.reset();
        closeContactModal();
    } catch (error) {
        showToast(error.message || "Não foi possível enviar a mensagem.", "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function openAdminEmailNoticeModal() {
    if (!elements.adminEmailNoticeModal) return;
    if (elements.adminEmailNoticeToInput && state.authEmail && !elements.adminEmailNoticeToInput.value.trim()) {
        elements.adminEmailNoticeToInput.value = state.authEmail;
    }
    if (elements.adminEmailNoticeActionUrlInput && !elements.adminEmailNoticeActionUrlInput.value.trim()) {
        elements.adminEmailNoticeActionUrlInput.value = `${window.location.origin}/seals`;
    }
    elements.adminEmailNoticeModal.classList.remove("hidden");
    elements.adminEmailNoticeModal.setAttribute("aria-hidden", "false");
}

function closeAdminEmailNoticeModal() {
    if (!elements.adminEmailNoticeModal) return;
    elements.adminEmailNoticeModal.classList.add("hidden");
    elements.adminEmailNoticeModal.setAttribute("aria-hidden", "true");
}

async function handleAdminEmailNoticeSubmit(event) {
    event.preventDefault();
    if (!state.emailEnabled) {
        showToast("Envio de e-mail ainda não está configurado.", "warning");
        return;
    }
    const payload = {
        email: (elements.adminEmailNoticeToInput?.value || "").trim(),
        subject: (elements.adminEmailNoticeSubjectInput?.value || "").trim(),
        message: (elements.adminEmailNoticeMessageInput?.value || "").trim(),
        actionUrl: (elements.adminEmailNoticeActionUrlInput?.value || "").trim(),
        actionLabel: (elements.adminEmailNoticeActionLabelInput?.value || "").trim(),
    };
    if (!payload.email || !payload.subject || !payload.message) {
        showToast("Preencha e-mail, assunto e mensagem.", "warning");
        return;
    }
    const submitButton = elements.adminEmailNoticeForm?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        const { response, payload: result } = await window.AppCore.jsonRequest("/api/admin/email-notice", {
            method: "POST",
            body: payload,
        });
        if (!response.ok) {
            throw new Error(result.error || "Não foi possível enviar o aviso.");
        }
        showToast(result.message || "Aviso enviado com sucesso.");
        elements.adminEmailNoticeForm?.reset();
        closeAdminEmailNoticeModal();
    } catch (error) {
        showToast(error.message || "Não foi possível enviar o aviso.", "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function applyTheme(themeKey) {
    state.theme = window.AppThemes.applyTheme(themeKey, {
        toggleElement: elements.themeToggle,
        withOutline: true,
    });
}

function savePreferences() {
    const key = state.authEmail ? `seal_theme_${state.authEmail}` : "seal_theme_guest";
    localStorage.setItem(key, state.theme);
}

function saveSealCardViewPreference() {
    try {
        localStorage.setItem(SEAL_CARD_VIEW_STORAGE_KEY, state.simpleSealCards ? "simple" : "default");
    } catch (_error) {
    }
}

function loadSealCardViewPreference() {
    try {
        state.simpleSealCards = localStorage.getItem(SEAL_CARD_VIEW_STORAGE_KEY) === "simple";
    } catch (_error) {
        state.simpleSealCards = false;
    }
}

function syncSealCardViewControls() {
    [elements.templateSimpleViewToggle, elements.accountSimpleViewToggle].forEach((button) => {
        if (!button) {
            return;
        }
        button.classList.toggle("chip-btn--active", state.simpleSealCards);
        button.setAttribute("aria-pressed", String(state.simpleSealCards));
    });
    if (elements.templateList) {
        elements.templateList.classList.toggle("seals-grid--simple", state.simpleSealCards);
    }
    if (elements.accountSealList) {
        elements.accountSealList.classList.toggle("seals-grid--simple", state.simpleSealCards);
    }
}

function setSealCardViewMode(enabled) {
    state.simpleSealCards = !!enabled;
    saveSealCardViewPreference();
    syncSealCardViewControls();
    renderTemplates();
    renderAccountSeals();
}

function saveHideMaxedSealsPreference() {
    try {
        localStorage.setItem(HIDE_MAXED_SEALS_STORAGE_KEY, state.hideMaxedSeals ? "hidden" : "visible");
    } catch (_error) {
    }
}

function loadHideMaxedSealsPreference() {
    try {
        state.hideMaxedSeals = localStorage.getItem(HIDE_MAXED_SEALS_STORAGE_KEY) === "hidden";
    } catch (_error) {
        state.hideMaxedSeals = false;
    }
}

function syncHideMaxedSealsControls() {
    [elements.templateHideMaxedToggle, elements.accountHideMaxedToggle].forEach((button) => {
        if (!button) {
            return;
        }
        button.classList.toggle("chip-btn--active", state.hideMaxedSeals);
        button.setAttribute("aria-pressed", String(state.hideMaxedSeals));
    });
}

function setHideMaxedSealsMode(enabled) {
    state.hideMaxedSeals = !!enabled;
    state.templatePage = 1;
    state.accountPage = 1;
    saveHideMaxedSealsPreference();
    syncHideMaxedSealsControls();
    if (state.hideMaxedSeals && !state.templateCatalogComplete) {
        ensureTemplateCatalogComplete()
            .then(() => {
                renderTemplates();
                renderAccountSeals();
            })
            .catch((error) => showToast(error.message || "Nao foi possivel carregar todos os selos.", "error"));
        return;
    }
    renderTemplates();
    renderAccountSeals();
}

function loadStoredPreferences() {
    const key = state.authEmail ? `seal_theme_${state.authEmail}` : "seal_theme_guest";
    const theme = localStorage.getItem(key);
    applyTheme(theme || "light");
}

function getNextThemeKey(current) {
    return window.AppThemes.getNextThemeKey(current);
}

function updateAvatarDisplay() {
    const defaultAvatar = "./assets/Seal_Opener_Icon.png";
    if (elements.userAvatarImg) {
        elements.userAvatarImg.src = state.avatarUrl || defaultAvatar;
    }
}

function updateProfileSummary() {
    if (elements.userProfileCount) {
        elements.userProfileCount.textContent = state.accounts.length || 0;
    }
}

function openProfileModal() {
    if (!elements.profileModal) return;
    if (elements.profileAvatarInput) {
        elements.profileAvatarInput.value = state.avatarUrl || "";
    }
    elements.profileModal.classList.remove("hidden");
    elements.profileModal.setAttribute("aria-hidden", "false");
}

async function handleProfileSave(event) {
    event.preventDefault();
    const avatar = (elements.profileAvatarInput?.value || "").trim();
    if (avatar) {
        state.avatarUrl = avatar;
        if (elements.userAvatarImg) elements.userAvatarImg.src = avatar;
    }
    savePreferences();
    showToast("Perfil atualizado localmente. (AlteraÃ§Ã£o de email/senha disponÃ­vel em breve)");
    if (elements.profileModal) {
        elements.profileModal.classList.add("hidden");
        elements.profileModal.setAttribute("aria-hidden", "true");
    }
}

function renderAttributeStats() {
    if (!elements.attributeStatsPanels.length) {
        return;
    }
    const totals = {};
    state.mySeals.forEach((entry) => {
        const template = entry.template || {};
        const attribute = normalizeAttributeKey(template.attribute);
        if (!attribute) {
            return;
        }
        const quantity = Math.max(parseInteger(entry.quantity) || 0, 0);
        if (quantity <= 0) {
            return;
        }
        const statPerSeal = getEntryCurrentValue(entry);
        const goldPerSeal = getAccountUnitCost(entry, template);
        if (!totals[attribute]) {
            totals[attribute] = { statValue: 0, goldValue: 0, count: 0 };
        }
        totals[attribute].statValue += statPerSeal;
        totals[attribute].goldValue += goldPerSeal * quantity;
        totals[attribute].count += 1;
    });
    const maxTotals = calculateAttributeMaxTotals();

    elements.attributeStatsPanels.forEach((panel) => {
        panel.querySelectorAll("[data-attribute]").forEach((card) => {
            const attr = card.dataset.attribute;
            const metaElement = card.querySelector(".attribute-card__meta");
            const valueElement = card.querySelector(".attribute-card__value");
            const progressElement = ensureAttributeProgressElement(card, valueElement);
            const currencyWrapper = card.querySelector("[data-attribute-currency]");
            const iconElement = currencyWrapper ? currencyWrapper.querySelector(".currency-icon") : null;
            const textElement = currencyWrapper ? currencyWrapper.querySelector(".currency-text") : null;
            const entry = totals[attr] || { statValue: 0, goldValue: 0, count: 0 };
            const maxValue = maxTotals[attr] || 0;
            if (metaElement) {
                const label = entry.count === 1 ? "Selo" : "Selos";
                metaElement.textContent = `${entry.count} ${label}`;
            }
            if (valueElement) {
                valueElement.textContent = formatAttributeValue(attr, entry.statValue);
            }
            if (progressElement) {
                progressElement.textContent = `${formatAttributeValue(attr, entry.statValue)} / ${formatAttributeValue(attr, maxValue)}`;
                progressElement.title = "Atual / maximo possivel completando todos os selos deste atributo";
            }
            if (currencyWrapper && textElement) {
                const breakdown = formatGoldBreakdown(entry.goldValue);
                if (iconElement) {
                    iconElement.style.display = "none";
                }
                renderGoldInline(textElement, breakdown);
            }
            card.classList.toggle("active", state.attributeFilter === attr);
        });
    });
}

function calculateAttributeMaxTotals() {
    const totals = {};
    state.templates.forEach((template) => {
        const attribute = normalizeAttributeKey(template.attribute);
        if (!attribute) {
            return;
        }
        const { maxValue, maxThreshold } = computeTemplateMax(template);
        if (!maxThreshold) {
            return;
        }
        totals[attribute] = (totals[attribute] || 0) + (parseNumber(maxValue) || 0);
    });
    return totals;
}

function ensureAttributeProgressElement(card, valueElement) {
    let progressElement = card.querySelector("[data-attribute-progress]");
    if (!progressElement && valueElement) {
        progressElement = document.createElement("span");
        progressElement.className = "attribute-card__progress";
        progressElement.dataset.attributeProgress = "true";
        valueElement.insertAdjacentElement("afterend", progressElement);
    }
    return progressElement;
}

function updateAttributeFilterActiveState() {
    if (!elements.attributeFilter) {
        return;
    }
    elements.attributeFilter.querySelectorAll(".filter-pill").forEach((pill) => {
        pill.classList.toggle("active", pill.dataset.attribute === state.attributeFilter);
    });
}

function renderAccountSeals() {
    if (!elements.accountSealList) {
        return;
    }
    elements.accountSealList.classList.toggle("seals-grid--simple", state.simpleSealCards);
    const search = state.accountSearch.toLowerCase();
    renderAttributeStats();
    renderAccountTotalGold();
    const currentFilter = (state.attributeFilter || "TODOS").toUpperCase();
    const filtered = state.mySeals.filter((entry) => {
        const template = entry.template || {};
        const attr = normalizeAttributeKey(template.attribute);
        if (currentFilter !== "TODOS" && attr !== currentFilter) {
            return false;
        }
        if (state.hideMaxedSeals && isSealAtMax(template, entry.quantity)) {
            return false;
        }
        if (!search) return true;
        const target = `${template.name || ""} ${template.attribute || ""}`.toLowerCase();
        return target.includes(search);
    }).sort((a, b) => compareTemplateOrder(a.template, b.template));

    if (elements.mySealCountBadge) {
        const count = state.mySeals.filter((entry) => Number(entry.quantity) > 0).length;
        elements.mySealCountBadge.textContent = `${count} ${count === 1 ? "selo" : "selos"}`;
    }

    if (elements.mySealsTabCount) {
        elements.mySealsTabCount.textContent = `${filtered.length}`;
    }

    if (!filtered.length) {
        elements.accountSealList.classList.add("empty-state");
        elements.accountSealList.textContent = state.hideMaxedSeals
            ? "Nenhum selo visivel. Os selos no nivel maximo estao ocultos."
            : "Nenhum seal vinculado a este perfil de jogo.";
        renderListPagination(elements.accountPager, null, () => {});
        return;
    }
    elements.accountSealList.classList.remove("empty-state");
    elements.accountSealList.innerHTML = "";

    const pagination = paginateItems(filtered, state.accountPage, ACCOUNT_SEAL_PAGE_SIZE);
    state.accountPage = pagination.currentPage;
    pagination.items.forEach((entry) => {
        const template = entry.template || {};
        const card = document.createElement("div");
        card.className = `seal-card account-seal-card${state.simpleSealCards ? " seal-card--simple" : ""}`;
        card.dataset.templateId = String(template.id);
        applyMaxedSealState(card, template, entry.quantity);

        const header = document.createElement("div");
        header.className = "seal-card__header";
        const title = document.createElement("h3");
        title.textContent = template.name || "Seal";
        const meta = document.createElement("div");
        meta.className = "seal-card__meta";
        const badge = document.createElement("span");
        badge.className = "attribute-badge";
        badge.dataset.attribute = normalizeAttributeKey(template.attribute);
        badge.textContent = template.attribute || "";
        const quantityLabel = document.createElement("span");
        quantityLabel.className = "base-value";
        quantityLabel.textContent = `${formatThreshold(entry.quantity)} selos`;
        meta.appendChild(badge);
        meta.appendChild(quantityLabel);
        header.appendChild(title);
        header.appendChild(meta);
        card.appendChild(header);

        const accountUnitCost = getAccountUnitCost(entry, template);
        const accountCostDisplay = formatGoldDisplay(accountUnitCost);
        const costRow = document.createElement("div");
        costRow.className = "seal-card__currency";
        const costIcon = getCurrencyIconUrl(accountCostDisplay.icon);
        if (costIcon) {
            const icon = document.createElement("img");
            icon.className = "currency-icon";
            icon.alt = accountCostDisplay.unit || "";
            prepareIconImage(icon);
            icon.src = costIcon;
            costRow.appendChild(icon);
        }
        const costLabel = document.createElement("span");
        costLabel.className = "seal-card__currency-label";
        costLabel.textContent = `Gold (${getCurrentServerLabel()})`;
        const costValue = document.createElement("span");
        costValue.className = "currency-text";
        costValue.textContent = formatGoldText(accountCostDisplay);
        costRow.appendChild(costLabel);
        costRow.appendChild(costValue);
        card.appendChild(costRow);

        if (!state.simpleSealCards) {
            const actions = document.createElement("div");
            actions.className = "account-seal-actions";
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "chip-btn";
            editBtn.textContent = "Editar";
            editBtn.addEventListener("click", () => openAccountSealModal(entry));
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "chip-btn chip-btn--danger";
            removeBtn.textContent = "Remover";
            removeBtn.addEventListener("click", async () => {
                const confirmRemove = window.confirm("Remover este My Seal do perfil de jogo?");
                if (!confirmRemove) return;
                try {
                    await removeAccountSeal(entry.id);
                } catch (error) {
                    showToast(error.message || "Falha ao remover o My Seal.", "error");
                }
            });
            actions.appendChild(editBtn);
            actions.appendChild(removeBtn);
            card.appendChild(actions);
        }

        const stats = document.createElement("div");
        stats.className = "account-seal-stats";
        const current = entry.currentLevel;
        if (current) {
            const value = current.value ?? template.baseValue;
            const formattedValue = formatAttributeValue(template.attribute, value);
            const formattedPercent = formatPercentage(current.percentage);
            const block = document.createElement("div");
            block.className = "account-seal-stats__item";
            block.innerHTML = `
                <p class="account-seal-stats__label">Nivel atual: ${current.name}</p>
                <p class="account-seal-stats__value">${formattedValue} (${formattedPercent})</p>
            `;
            stats.appendChild(block);
        }
        if (entry.nextLevel) {
            const remaining = Math.max((entry.nextLevel.threshold || 0) - (entry.quantity || 0), 0);
            const nextBlock = document.createElement("div");
            nextBlock.className = "account-seal-stats__item";
            nextBlock.innerHTML = `
                <p class="account-seal-stats__label">Proximo nivel: ${entry.nextLevel.name}</p>
                <p class="account-seal-stats__value">Faltam ${formatThreshold(remaining)} selos</p>
            `;
            stats.appendChild(nextBlock);
        }
        card.appendChild(stats);
        if (!state.simpleSealCards) window.SealCardDate?.append(card, entry.createdAt, "perfil");
        attachTemplateDrag(card, template);
        elements.accountSealList.appendChild(card);
    });

    renderListPagination(elements.accountPager, pagination, (nextPage) => {
        state.accountPage = nextPage;
        renderAccountSeals();
    });
}

async function handleCalculatorSubmit(event) {
    event.preventDefault();
    if (elements.calculatorAttributeSelect) {
        state.calculatorAttribute = elements.calculatorAttributeSelect.value;
    }
    if (elements.calculatorTargetInput) {
        state.calculatorTarget = elements.calculatorTargetInput.value;
    }
    const target = parseNumber(state.calculatorTarget);
    if (target === null || target < 0) {
        showToast("Informe um valor alvo valido.", "warning");
        renderCalculatorResults(null);
        return;
    }
    if (
        state.openerPrice &&
        parseGoldInputValue(state.openerPrice, { defaultUnitKey: "M" }) === null
    ) {
        showToast("Informe um gold valido por opener. Ex.: 250B, 1,5M ou 2T.", "warning");
        return;
    }
    if (
        state.calculatorBudgetMode &&
        state.calculatorBudget &&
        parseGoldInputValue(state.calculatorBudget, { defaultUnitKey: "M" }) === null
    ) {
        showToast("Informe um gold valido no limite. Ex.: 250B, 1,5M ou 2T.", "warning");
        return;
    }
    localStorage.setItem("dmowiki.seals.calculator-state", JSON.stringify({
        calculatorAttribute: state.calculatorAttribute,
        calculatorStrategy: state.calculatorStrategy,
        calculatorBudgetMode: state.calculatorBudgetMode,
        calculatorBudget: state.calculatorBudget,
        calculatorTarget: state.calculatorTarget,
        openersOwned: state.openersOwned,
    }));
    await runCalculatorWithFullCatalog();
}

function runCalculator() {
    const attribute = state.calculatorAttribute || (state.attributes[0] || "AT");
    const target = parseNumber(state.calculatorTarget);
    if (target === null || target < 0) {
        renderCalculatorResults(null);
        return;
    }
    const plan = buildCalculatorPlan(attribute, target);
    state.calculatorPlan = plan;
    renderTemplates();
    renderCalculatorResults(plan);
}

function refreshCalculator() {
    syncCalculatorControls();
    if (state.calculatorTarget) {
        runCalculatorWithFullCatalog();
        return;
    }
    updateCalculatorSummary();
    if (elements.calculatorResults) {
        elements.calculatorResults.classList.add("empty-state");
        elements.calculatorResults.textContent =
            "Escolha um atributo e informe o valor alvo para montar o plano.";
    }
}

function calculateCurrentAttributeTotal(attribute) {
    if (!attribute) {
        return { total: 0, entries: [] };
    }
    const targetAttribute = normalizeAttributeKey(attribute);
    const entries = state.mySeals.filter((entry) => normalizeAttributeKey(entry.template?.attribute) === targetAttribute);
    const total = entries.reduce((sum, entry) => sum + getEntryCurrentValue(entry), 0);
    return { total, entries };
}

function resolveLevelValue(levelInfo, baseValue) {
    const explicitValue = parseNumber(levelInfo?.value);
    if (explicitValue !== null) {
        return explicitValue;
    }
    const percentValue = parseNumber(levelInfo?.percentage);
    if (percentValue !== null) {
        return ((parseNumber(baseValue) || 0) * percentValue) / 100;
    }
    return null;
}

function computeTemplateMax(template) {
    const baseValue = parseNumber(template.baseValue) || 0;
    const levels = template.levels || {};
    let maxValue = baseValue;
    let maxThreshold = 0;

    state.levels.forEach((levelName) => {
        const info = levels[levelName] || {};
        const threshold = parseInteger(info.threshold) || 0;
        const computedValue = resolveLevelValue(info, baseValue);
        if (computedValue === null) {
            return;
        }
        if (computedValue > maxValue || (computedValue === maxValue && threshold > maxThreshold)) {
            maxValue = computedValue;
            maxThreshold = threshold;
        }
    });

    if (!maxThreshold) {
        const thresholds = state.levels
            .map((levelName) => parseInteger(levels[levelName]?.threshold))
            .filter((value) => value);
        maxThreshold = thresholds.length ? Math.max(...thresholds) : 0; // 0 => sem limite conhecido
    }

    return { maxValue, maxThreshold };
}

function clampQuantityToMax(template, quantity) {
    const parsed = parseInteger(quantity);
    const { maxThreshold } = computeTemplateMax(template || {});
    if (parsed === null) {
        return { value: null, capped: false, max: maxThreshold || 0 };
    }
    if (maxThreshold && parsed > maxThreshold) {
        return { value: maxThreshold, capped: true, max: maxThreshold };
    }
    return { value: parsed, capped: false, max: maxThreshold || 0 };
}

function getAccountSealForTemplate(template, account = getActiveAccount()) {
    if (!template || !account) {
        return null;
    }
    return state.mySeals.find((entry) => entry.sealId === template.id && entry.account === account) || null;
}

function isSealAtMax(template, quantity) {
    const parsedQuantity = parseInteger(quantity);
    if (parsedQuantity === null) {
        return false;
    }
    const { maxThreshold } = computeTemplateMax(template || {});
    return !!maxThreshold && parsedQuantity >= maxThreshold;
}

function addMaxedSealBadge(card) {
    const badge = document.createElement("span");
    badge.className = "seal-card__max-badge";
    badge.innerHTML = "&#10003;";
    badge.title = "Nivel maximo";
    badge.setAttribute("aria-label", "Nivel maximo");
    card.appendChild(badge);
}

function applyMaxedSealState(card, template, quantity) {
    const isMaxed = isSealAtMax(template, quantity);
    card.classList.toggle("seal-card--maxed", isMaxed);
    if (isMaxed) {
        addMaxedSealBadge(card);
    }
}

function computeTemplateValueAtQuantity(template, quantity) {
    const baseValue = parseNumber(template.baseValue) || 0;
    const levels = template.levels || {};
    let best = { threshold: 0, value: 0 };
    state.levels.forEach((levelName) => {
        const info = levels[levelName] || {};
        const threshold = parseInteger(info.threshold) || 0;
        const resolved = resolveLevelValue(info, baseValue);
        if (resolved === null) {
            return;
        }
        if (quantity >= threshold && threshold >= best.threshold) {
            best = { threshold, value: resolved };
        }
    });
    return best.value;
}

function getEntryCurrentValue(entry) {
    const quantity = Math.max(parseInteger(entry?.quantity) || 0, 0);
    if (quantity <= 0) {
        return 0;
    }
    const template = entry.template || {};
    const baseValue = parseNumber(template.baseValue) || 0;
    const level = entry.currentLevel || {};
    const value = parseNumber(level.value);
    if (value !== null) {
        return value;
    }
    const percent = parseNumber(level.percentage);
    if (percent !== null) {
        return (baseValue * percent) / 100;
    }
    return computeTemplateValueAtQuantity(template, quantity);
}

function getCalculatorStrategyLabel(strategyKey) {
    return CALCULATOR_STRATEGY_LABELS[strategyKey] || CALCULATOR_STRATEGY_LABELS.auto;
}

function calculateOpenersFromSeals(totalSeals) {
    const numeric = parseInteger(totalSeals) || 0;
    return numeric > 0 ? Math.ceil(numeric / 50) : 0;
}

function calculateAdditionalOpeners(currentQuantity, targetQuantity) {
    const current = Math.max(parseInteger(currentQuantity) || 0, 0);
    const target = Math.max(parseInteger(targetQuantity) || 0, current);
    return calculateOpenersFromSeals(Math.max(target - current, 0));
}

function calculateIncrementalOpeners(initialQuantity, currentPlannedQuantity, targetQuantity) {
    const initial = Math.max(parseInteger(initialQuantity) || 0, 0);
    const current = Math.max(parseInteger(currentPlannedQuantity) || 0, initial);
    const target = Math.max(parseInteger(targetQuantity) || 0, current);
    const before = calculateOpenersFromSeals(Math.max(current - initial, 0));
    const after = calculateOpenersFromSeals(Math.max(target - initial, 0));
    return Math.max(after - before, 0);
}

function calculateOpenerWasteForUpgrade(currentQuantity, targetQuantity) {
    const current = Math.max(parseInteger(currentQuantity) || 0, 0);
    const target = Math.max(parseInteger(targetQuantity) || 0, current);
    const sealsAdded = Math.max(target - current, 0);
    const requiredOpeners = calculateOpenersFromSeals(sealsAdded);
    return requiredOpeners > 0 ? (requiredOpeners * 50) - sealsAdded : 0;
}

function calculateTotalOpenersForPlanEntries(entries) {
    return (Array.isArray(entries) ? entries : []).reduce(
        (sum, entry) => sum + calculateAdditionalOpeners(entry?.currentQuantity, entry?.targetQuantity),
        0,
    );
}

function buildTemplateUpgradePath(template, currentQuantity) {
    const baseValue = parseNumber(template?.baseValue) || 0;
    const thresholdValues = new Map();

    state.levels.forEach((levelName) => {
        const info = template?.levels?.[levelName] || {};
        const threshold = parseInteger(info.threshold);
        const value = resolveLevelValue(info, baseValue);
        if (threshold === null || threshold <= currentQuantity || value === null) {
            return;
        }
        const currentBest = thresholdValues.get(threshold);
        if (currentBest === undefined || value > currentBest) {
            thresholdValues.set(threshold, value);
        }
    });

    const steps = Array.from(thresholdValues.entries()).sort((a, b) => a[0] - b[0]);
    const path = [];
    let fromQuantity = currentQuantity;
    let fromValue = computeTemplateValueAtQuantity(template, currentQuantity);

    steps.forEach(([targetQuantity, nextValue]) => {
        const gain = roundNumber(nextValue - fromValue, 4);
        if (targetQuantity <= fromQuantity || gain <= 0) {
            return;
        }
        path.push({
            fromQuantity,
            targetQuantity,
            currentValue: fromValue,
            nextValue,
            gain,
            sealsNeeded: targetQuantity - fromQuantity,
        });
        fromQuantity = targetQuantity;
        fromValue = nextValue;
    });

    return path;
}

function getCandidateBudgetState(candidate, entryMap, totalGold, openersOwned, openerUnitCost) {
    const currentEntries = Array.from(entryMap.values());
    const currentPlanOpeners = calculateTotalOpenersForPlanEntries(currentEntries);
    const currentOpenersToBuy = Math.max(currentPlanOpeners - openersOwned, 0);
    const currentOpenerGold = currentOpenersToBuy * openerUnitCost;
    const existingEntry = entryMap.get(candidate?.templateInfo?.template?.id) || null;
    const baseQuantity = existingEntry ? existingEntry.currentQuantity : candidate?.step?.fromQuantity || 0;
    const beforeTemplateOpeners = existingEntry
        ? calculateAdditionalOpeners(existingEntry.currentQuantity, existingEntry.targetQuantity)
        : 0;
    const afterTemplateOpeners = calculateAdditionalOpeners(baseQuantity, candidate?.step?.targetQuantity);
    const totalOpenersAfter = currentPlanOpeners - beforeTemplateOpeners + afterTemplateOpeners;
    const openersToBuyAfter = Math.max(totalOpenersAfter - openersOwned, 0);
    const openerGoldAfter = openersToBuyAfter * openerUnitCost;
    return {
        totalOpenersAfter,
        openersToBuyAfter,
        incrementalOpenerGold: Math.max(openerGoldAfter - currentOpenerGold, 0),
        totalBudgetUsedAfter: totalGold + (candidate?.sealGold || 0) + openerGoldAfter,
    };
}

function getAppliedPlanSpendState(currentQuantity, newQuantity, unitCost, openersOwned, openerUnitCost) {
    const safeCurrentQuantity = Math.max(parseInteger(currentQuantity) || 0, 0);
    const safeNewQuantity = Math.max(parseInteger(newQuantity) || 0, safeCurrentQuantity);
    const sealsAdded = Math.max(safeNewQuantity - safeCurrentQuantity, 0);
    const additionalOpeners = calculateAdditionalOpeners(safeCurrentQuantity, safeNewQuantity);
    const availableOpeners = Math.max(parseInteger(openersOwned) || 0, 0);
    const openersCovered = Math.min(availableOpeners, additionalOpeners);
    const openersToBuy = Math.max(additionalOpeners - openersCovered, 0);
    const safeUnitCost = Math.max(parseNumber(unitCost) || 0, 0);
    const safeOpenerUnitCost = Math.max(parseNumber(openerUnitCost) || 0, 0);
    const sealGoldSpent = roundNumber(safeUnitCost * sealsAdded, 2);
    const openerGoldSpent = roundNumber(openersToBuy * safeOpenerUnitCost, 2);

    return {
        sealsAdded,
        additionalOpeners,
        openersCovered,
        openersToBuy,
        remainingOpeners: Math.max(availableOpeners - openersCovered, 0),
        sealGoldSpent,
        openerGoldSpent,
        totalGoldSpent: roundNumber(sealGoldSpent + openerGoldSpent, 2),
    };
}

function applyConsumedCalculatorResources(spendState) {
    if (!spendState) {
        return;
    }
    state.openersOwned = Math.max(spendState.remainingOpeners || 0, 0);

    if (state.calculatorBudgetMode) {
        const currentBudget = Math.max(
            parseGoldInputValue(state.calculatorBudget, { defaultUnitKey: "M" }) || 0,
            0,
        );
        const nextBudget = Math.max(currentBudget - (spendState.totalGoldSpent || 0), 0);
        state.calculatorBudget = formatGoldCompactValue(nextBudget);
    }

    syncCalculatorControls();
}

function resolveCalculatorStrategy(requestedStrategy, templates) {
    if (requestedStrategy === "ultra") {
        return {
            strategy: "ultra",
            usePricedOnly: true,
            notice: "Modo Ultra Max: priorizando o melhor custo-beneficio em gold total (selos + openers), com maior ganho como desempate.",
        };
    }
    if (requestedStrategy === "seals") {
        return { strategy: "seals", usePricedOnly: true, notice: null };
    }
    if (requestedStrategy === "openers") {
        return {
            strategy: "openers",
            usePricedOnly: true,
            notice: "Modo Menos openers: priorizando menos openers novos, menos desperdicio e menor gold como desempate.",
        };
    }
    return {
        strategy: "auto",
        usePricedOnly: true,
        notice: "Modo Inteligente: priorizando menor custo geral, encaixe de openers e menor desperdicio.",
    };
}

function compareNumericValues(a, b) {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

function buildPlanCandidate(templateInfo, remainingTarget, openerUnitCost, strategy) {
    const step = templateInfo.path[templateInfo.stepIndex];
    if (!step) {
        return null;
    }
    const usefulGain = Math.max(Math.min(step.gain, remainingTarget), 0.0001);
    const additionalOpeners = calculateIncrementalOpeners(
        templateInfo.initialQuantity,
        templateInfo.currentQuantity,
        step.targetQuantity,
    );
    const sealGold = (templateInfo.unitCost || 0) * step.sealsNeeded;
    const openerGold = additionalOpeners * openerUnitCost;
    const effectiveGold = sealGold + openerGold;
    const overshoot = Math.max(step.gain - remainingTarget, 0);
    const sealEfficiency = step.sealsNeeded / usefulGain;
    const goldEfficiency = effectiveGold / usefulGain;
    const openersEfficiency = additionalOpeners / usefulGain;
    const openerWaste = calculateOpenerWasteForUpgrade(templateInfo.initialQuantity, step.targetQuantity);
    const strategyScore =
        strategy === "seals"
            ? sealEfficiency + (additionalOpeners * 0.05) + (overshoot / usefulGain)
            : strategy === "ultra"
              ? goldEfficiency
            : goldEfficiency +
              (sealEfficiency * 0.35) +
              (additionalOpeners * 0.1) +
              (openerWaste / 500) +
              (overshoot / usefulGain);

    return {
        templateInfo,
        template: templateInfo.template,
        step,
        usefulGain,
        additionalOpeners,
        sealGold,
        openerGold,
        effectiveGold,
        overshoot,
        sealEfficiency,
        goldEfficiency,
        openersEfficiency,
        openerWaste,
        strategyScore,
    };
}

function comparePlanCandidates(a, b, strategy) {
    if (strategy === "seals") {
        return (
            compareNumericValues(a.sealEfficiency, b.sealEfficiency) ||
            compareNumericValues(a.additionalOpeners, b.additionalOpeners) ||
            compareNumericValues(a.overshoot, b.overshoot) ||
            compareNumericValues(a.effectiveGold, b.effectiveGold) ||
            compareNumericValues(a.step.sealsNeeded, b.step.sealsNeeded) ||
            a.template.name.localeCompare(b.template.name, "pt", { sensitivity: "base" })
        );
    }
    if (strategy === "openers") {
        return (
            compareNumericValues(a.additionalOpeners, b.additionalOpeners) ||
            compareNumericValues(a.openersEfficiency, b.openersEfficiency) ||
            compareNumericValues(a.openerWaste, b.openerWaste) ||
            compareNumericValues(a.overshoot, b.overshoot) ||
            compareNumericValues(a.goldEfficiency, b.goldEfficiency) ||
            compareNumericValues(a.step.sealsNeeded, b.step.sealsNeeded) ||
            a.template.name.localeCompare(b.template.name, "pt", { sensitivity: "base" })
        );
    }
    if (strategy === "ultra") {
        return (
            compareNumericValues(a.goldEfficiency, b.goldEfficiency) ||
            compareNumericValues(b.usefulGain, a.usefulGain) ||
            compareNumericValues(a.effectiveGold, b.effectiveGold) ||
            compareNumericValues(a.additionalOpeners, b.additionalOpeners) ||
            compareNumericValues(a.step.sealsNeeded, b.step.sealsNeeded) ||
            a.template.name.localeCompare(b.template.name, "pt", { sensitivity: "base" })
        );
    }
    return (
        compareNumericValues(a.strategyScore, b.strategyScore) ||
        compareNumericValues(a.additionalOpeners, b.additionalOpeners) ||
        compareNumericValues(a.overshoot, b.overshoot) ||
        compareNumericValues(a.step.sealsNeeded, b.step.sealsNeeded) ||
        a.template.name.localeCompare(b.template.name, "pt", { sensitivity: "base" })
    );
}

function calculateSingleSealSuggestion(attribute, strategy = "auto") {
    const blocked = getBlockedTemplateSet();
    const targetAttribute = normalizeAttributeKey(attribute);
    const candidates = state.templates.filter(
        (template) => normalizeAttributeKey(template.attribute) === targetAttribute && !blocked.has(template.id),
    );
    const openerUnitCost = parseGoldInputValue(state.openerPrice, { defaultUnitKey: "M" }) || 0;
    let best = null;
    candidates.forEach((template) => {
        const entry = state.mySeals.find((item) => item.sealId === template.id) || null;
        const currentQty = entry ? entry.quantity || 0 : 0;
        const currentValue = computeTemplateValueAtQuantity(template, currentQty);
        const nextValue = computeTemplateValueAtQuantity(template, currentQty + 1);
        const gain = Math.max(nextValue - currentValue, 0);
        const cost = parseNumber(getAccountUnitCost(entry, template));
        if (!gain || cost === null || cost <= 0) {
            return;
        }

        const nextQuantity = currentQty + 1;
        const additionalOpeners = calculateAdditionalOpeners(currentQty, nextQuantity);
        const openerWaste = calculateOpenerWasteForUpgrade(currentQty, nextQuantity);
        const totalCost = (cost || 0) + (additionalOpeners * openerUnitCost);
        const displayCost = strategy === "ultra" ? totalCost : cost || 0;
        const metric =
            strategy === "openers"
                ? (additionalOpeners * 1_000_000) + (openerWaste * 1_000) + ((cost && cost > 0 ? cost : 1) / gain)
                : strategy === "ultra"
                  ? totalCost / gain
                : strategy === "seals" || cost === null || cost <= 0
                  ? 1 / gain
                  : cost / gain;

        if (!best || metric < best.metric || (metric === best.metric && displayCost < (best.cost || 0))) {
            best = {
                template,
                currentQuantity: currentQty,
                gain,
                cost: displayCost,
                metric,
                strategy,
            };
        }
    });
    return best;
}

function buildCalculatorPlan(attribute, targetValue) {
    const target = parseNumber(targetValue);
    if (target === null || target < 0) {
        return null;
    }
    const activeAccount = getActiveAccount();
    const openersOwned = parseInteger(state.openersOwned) || 0;
    const openerUnitCost = parseGoldInputValue(state.openerPrice, { defaultUnitKey: "M" }) || 0;
    const budgetMode = !!state.calculatorBudgetMode;
    const goldBudget = budgetMode
        ? Math.max(parseGoldInputValue(state.calculatorBudget, { defaultUnitKey: "M" }) || 0, 0)
        : null;
    const blocked = getBlockedTemplateSet();
    const currentSnapshot = calculateCurrentAttributeTotal(attribute);
    let remainingTarget = Math.max(target - currentSnapshot.total, 0);
    const accountEntries = new Map();

    state.mySeals.forEach((entry) => {
        if (entry && entry.sealId !== undefined && entry.sealId !== null) {
            accountEntries.set(entry.sealId, entry);
        }
    });

    const rawTemplateInfos = state.templates
        .filter((template) => normalizeAttributeKey(template.attribute) === normalizeAttributeKey(attribute) && !blocked.has(template.id))
        .map((template) => {
            const accountEntry = accountEntries.get(template.id) || null;
            const currentQuantity = accountEntry ? accountEntry.quantity || 0 : 0;
            const unitCost = parseNumber(getAccountUnitCost(accountEntry, template));
            const currentValue = computeTemplateValueAtQuantity(template, currentQuantity);
            const costKnown = hasConfiguredSealUnitCost(accountEntry, template);
            return {
                template,
                accountEntry,
                account: activeAccount,
                currentQuantity,
                currentValue,
                initialQuantity: currentQuantity,
                initialValue: currentValue,
                unitCost: unitCost || 0,
                costKnown,
                path: buildTemplateUpgradePath(template, currentQuantity),
                stepIndex: 0,
            };
        })
        .filter((item) => item.path.length > 0);

    const strategyInfo = resolveCalculatorStrategy(state.calculatorStrategy, rawTemplateInfos);
    let excludedUnpricedCount = 0;
    const templateInfos = rawTemplateInfos.filter((item) => {
        if (!strategyInfo.usePricedOnly) {
            return true;
        }
        if (item.costKnown) {
            return true;
        }
        excludedUnpricedCount += 1;
        return false;
    });

    const entryMap = new Map();
    let collected = 0;
    let totalSeals = 0;
    let totalGold = 0;
    let guard = 0;
    let budgetBlocked = false;

    while (remainingTarget > 0 && guard < 20000) {
        guard += 1;
        const rawCandidates = templateInfos
            .map((templateInfo) =>
                buildPlanCandidate(
                    templateInfo,
                    remainingTarget,
                    openerUnitCost,
                    strategyInfo.strategy,
                ),
            )
            .filter(Boolean);

        if (!rawCandidates.length) {
            break;
        }

        let candidates = rawCandidates;
        if (budgetMode) {
            candidates = rawCandidates
                .map((candidate) => ({
                    ...candidate,
                    budgetState: getCandidateBudgetState(
                        candidate,
                        entryMap,
                        totalGold,
                        openersOwned,
                        openerUnitCost,
                    ),
                }))
                .filter((candidate) => candidate.budgetState.totalBudgetUsedAfter <= goldBudget + 0.0001);
            if (!candidates.length) {
                budgetBlocked = true;
                break;
            }
        }

        candidates.sort((a, b) => comparePlanCandidates(a, b, strategyInfo.strategy));
        const best = candidates[0];
        const selectedStep = best.step;
        const templateInfo = best.templateInfo;
        const previousQuantity = templateInfo.currentQuantity;
        const previousValue = templateInfo.currentValue;

        templateInfo.stepIndex += 1;
        templateInfo.currentQuantity = selectedStep.targetQuantity;
        templateInfo.currentValue = selectedStep.nextValue;

        collected += selectedStep.gain;
        remainingTarget = Math.max(remainingTarget - selectedStep.gain, 0);
        totalSeals += selectedStep.sealsNeeded;
        totalGold += best.sealGold;

        const existing = entryMap.get(templateInfo.template.id);
        if (existing) {
            existing.targetQuantity = templateInfo.currentQuantity;
            existing.projectedValue = templateInfo.currentValue;
            existing.gain = roundNumber(existing.projectedValue - existing.currentValue, 2);
            existing.sealsNeeded = existing.targetQuantity - existing.currentQuantity;
            existing.goldNeeded = roundNumber(existing.unitCost * existing.sealsNeeded, 2);
            existing.openersNeeded = calculateAdditionalOpeners(existing.currentQuantity, existing.targetQuantity);
            existing.openersEquivalent = existing.openersNeeded;
            existing.sealsPerPoint = existing.gain > 0 ? roundNumber(existing.sealsNeeded / existing.gain, 2) : 0;
            existing.goldPerPoint = existing.gain > 0 ? roundNumber(existing.goldNeeded / existing.gain, 2) : 0;
        } else {
            entryMap.set(templateInfo.template.id, {
                id: templateInfo.template.id,
                template: templateInfo.template,
                name: templateInfo.template.name,
                attribute: templateInfo.template.attribute,
                currentValue: previousValue,
                projectedValue: templateInfo.currentValue,
                gain: roundNumber(templateInfo.currentValue - previousValue, 2),
                sealsNeeded: templateInfo.currentQuantity - previousQuantity,
                openersNeeded: calculateAdditionalOpeners(previousQuantity, templateInfo.currentQuantity),
                openersEquivalent: calculateAdditionalOpeners(previousQuantity, templateInfo.currentQuantity),
                currentQuantity: previousQuantity,
                targetQuantity: templateInfo.currentQuantity,
                unitCost: templateInfo.unitCost,
                goldNeeded: roundNumber(best.sealGold, 2),
                sealsPerPoint:
                    templateInfo.currentValue > previousValue
                        ? roundNumber(
                              (templateInfo.currentQuantity - previousQuantity) /
                                  (templateInfo.currentValue - previousValue),
                              2,
                          )
                        : 0,
                goldPerPoint:
                    templateInfo.currentValue > previousValue && templateInfo.unitCost > 0
                        ? roundNumber(
                              best.sealGold / (templateInfo.currentValue - previousValue),
                              2,
                          )
                        : 0,
            });
        }
    }

    const planEntries = Array.from(entryMap.values())
        .filter((entry) => entry.gain > 0)
        .sort((a, b) => compareTemplateOrder(a.template, b.template));
    const totalOpeners = calculateTotalOpenersForPlanEntries(planEntries);
    const openersOwnedUsed = Math.min(openersOwned, totalOpeners);
    const openersToBuy = Math.max(totalOpeners - openersOwned, 0);
    const openerGoldNeeded = openersToBuy * openerUnitCost;
    const totalGoldWithOpeners = totalGold + openerGoldNeeded;
    const projectedTotal = currentSnapshot.total + collected;
    const singleSealSuggestion =
        remainingTarget > 0 && !budgetMode
            ? calculateSingleSealSuggestion(attribute, strategyInfo.strategy)
            : null;
    const unknownCostEntries = planEntries.filter((entry) => (entry.unitCost || 0) <= 0).length;
    const unknownCostSeals = planEntries
        .filter((entry) => (entry.unitCost || 0) <= 0)
        .reduce((sum, entry) => sum + (entry.sealsNeeded || 0), 0);

    return {
        attribute,
        target,
        currentTotal: currentSnapshot.total,
        remainingTarget: Math.max(target - currentSnapshot.total, 0),
        projectedTotal,
        totalSeals,
        totalOpeners,
        totalGold,
        totalGoldWithOpeners,
        openerGoldNeeded,
        openersToBuy,
        openersOwnedUsed,
        openersOwned,
        openerUnitCost,
        entries: planEntries,
        missingAfterPlan: Math.max(remainingTarget, 0),
        singleSealSuggestion,
        strategyRequested: state.calculatorStrategy,
        strategyUsed: strategyInfo.strategy,
        strategyLabel: getCalculatorStrategyLabel(strategyInfo.strategy),
        strategyNotice: strategyInfo.notice,
        budgetMode,
        budget: goldBudget,
        budgetUsed: budgetMode ? totalGoldWithOpeners : null,
        budgetRemaining: budgetMode ? Math.max(goldBudget - totalGoldWithOpeners, 0) : null,
        budgetBlocked,
        excludedUnpricedCount,
        unknownCostEntries,
        unknownCostSeals,
    };
}

function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function renderCalculatorResults(plan) {
    updateCalculatorSummary(plan);
    if (!elements.calculatorResults) {
        return;
    }
    if (!plan) {
        elements.calculatorResults.classList.add("empty-state");
        elements.calculatorResults.textContent =
            "Escolha um atributo e informe o valor alvo para montar o plano.";
        return;
    }
    elements.calculatorResults.classList.remove("empty-state");
    elements.calculatorResults.innerHTML = "";

    const summaryGrid = document.createElement("div");
    summaryGrid.className = "calculator-summary-grid calculator-summary-grid--primary";
    const openerTooltip = [
        `${formatThreshold(plan.totalSeals)} selos somando os tipos do plano.`,
        `Voce ja cobre ${formatThreshold(plan.openersOwnedUsed)} opener(s).`,
        "Cada aplicacao usa 1 opener para ate 50 selos do mesmo tipo.",
        "Se voce voltar depois para completar o mesmo selo, o calculo considera outro opener novo.",
        plan.openersToBuy > 0
            ? `Comprar ${formatThreshold(plan.openersToBuy)} por ${formatGoldText(
                  formatGoldDisplay(plan.openerGoldNeeded, { zeroAsValue: true }),
              )}.`
            : "Nenhuma compra adicional de opener.",
    ].join(" ");
    const modeTooltipParts = [];
    if (plan.strategyLabel) {
        modeTooltipParts.push(`Modo: ${plan.strategyLabel}.`);
    }
    if (plan.strategyNotice) {
        modeTooltipParts.push(plan.strategyNotice);
    }
    if (plan.budgetMode) {
        modeTooltipParts.push(
            `Limite de gold ativo: usando ${formatGoldText(
                formatGoldDisplay(plan.budgetUsed, { zeroAsValue: true }),
            )} de ${formatGoldText(formatGoldDisplay(plan.budget, { zeroAsValue: true }))}.`,
        );
    }
    if (plan.excludedUnpricedCount > 0) {
        modeTooltipParts.push(
            `${formatThreshold(plan.excludedUnpricedCount)} selo(s) sem gold configurado ficaram fora deste plano.`,
        );
    }
    if (plan.unknownCostEntries > 0) {
        modeTooltipParts.push(
            `O gold total nao inclui ${formatThreshold(plan.unknownCostSeals)} selos de ${formatThreshold(plan.unknownCostEntries)} item(ns) sem preco.`,
        );
    }

    summaryGrid.innerHTML = `
        <div class="calculator-summary-card calculator-summary-card--primary">
            <div class="calculator-summary-card__head">
                <p class="calculator-summary-card__label">Openers adicionais</p>
                <span class="calculator-tooltip-chip" title="${escapeHtml(openerTooltip)}" tabindex="0">Detalhes</span>
            </div>
            <p class="calculator-summary-card__value">${formatThreshold(plan.totalOpeners)}</p>
            <span class="calculator-summary-card__meta">${formatThreshold(plan.totalSeals)} selos no plano</span>
        </div>
        <div class="calculator-summary-card calculator-summary-card--primary">
            <div class="calculator-summary-card__head">
                <p class="calculator-summary-card__label">Gold necessario</p>
                ${
                    modeTooltipParts.length
                        ? `<span class="calculator-tooltip-chip" title="${escapeHtml(modeTooltipParts.join(" "))}" tabindex="0">Modo</span>`
                        : ""
                }
            </div>
            <p class="calculator-summary-card__value" id="calculatorSummaryGoldValue">--</p>
            <span class="calculator-summary-card__meta">Selos + openers</span>
        </div>
    `;
    elements.calculatorResults.appendChild(summaryGrid);

    const goldValueElement = document.getElementById("calculatorSummaryGoldValue");
    if (goldValueElement) {
        const breakdown = formatGoldBreakdown(plan.totalGoldWithOpeners);
        renderGoldInline(goldValueElement, breakdown);
    }
    if (plan.entries.length) {
        const exportRow = document.createElement("div");
        exportRow.className = "calculator-export-row";
        const exportCopy = document.createElement("span");
        exportCopy.textContent = "Baixe um resumo limpo do plano para consultar fora da pagina.";
        const exportBtn = document.createElement("button");
        exportBtn.type = "button";
        exportBtn.className = "ghost-btn ghost-btn--primary";
        exportBtn.textContent = "Baixar PDF do plano";
        exportBtn.addEventListener("click", () => handleExportCalculatorPdf(plan));
        exportRow.appendChild(exportCopy);
        exportRow.appendChild(exportBtn);
        elements.calculatorResults.appendChild(exportRow);
    }
    const quietStats = document.createElement("div");
    quietStats.className = "calculator-quiet-stats";
    const projectedGain = Math.max((plan.projectedTotal || 0) - (plan.currentTotal || 0), 0);
    const projectedReachedTarget = (plan.projectedTotal || 0) >= (plan.target || 0) && (plan.target || 0) > 0;
    const quietItems = [
        {
            label: "Projetado",
            value: formatAttributeValue(plan.attribute, plan.projectedTotal),
            cardClass: projectedReachedTarget
                ? "calculator-quiet-stat--success"
                : projectedGain > 0
                  ? "calculator-quiet-stat--highlight"
                  : "",
            valueClass: projectedGain > 0 ? "calculator-quiet-stat__value--highlight" : "",
            note: projectedReachedTarget
                ? "Alvo atingido pelo plano"
                : projectedGain > 0
                  ? `+${formatAttributeValue(plan.attribute, projectedGain)} no plano`
                  : "",
        },
    ];
    if (plan.budgetMode) {
        quietItems.push({
            label: "Gold disponivel",
            value: formatGoldText(formatGoldDisplay(plan.budget, { zeroAsValue: true })),
        });
        quietItems.push({
            label: "Sobra",
            value: formatGoldText(formatGoldDisplay(plan.budgetRemaining, { zeroAsValue: true })),
        });
    }
    quietStats.innerHTML = quietItems
        .map(
            (item) => `
                <div class="calculator-quiet-stat ${item.cardClass || ""}">
                    <span class="calculator-quiet-stat__label">${item.label}</span>
                    <strong class="calculator-quiet-stat__value ${item.valueClass || ""}">${item.value}</strong>
                    ${item.note ? `<span class="calculator-quiet-stat__note">${item.note}</span>` : ""}
                </div>
            `,
        )
        .join("");
    elements.calculatorResults.appendChild(quietStats);

    if (!plan.entries.length) {
        const empty = document.createElement("p");
        empty.className = "calculator-empty";
        const missingGoldOnly = plan.remainingTarget > 0 && plan.excludedUnpricedCount > 0;
        empty.textContent =
            plan.remainingTarget <= 0
                ? "Alvo ja atingido com os Meu Selos atuais."
                : missingGoldOnly
                  ? "Defina o gold dos selos deste atributo para montar o plano."
                : "Consiga selos para este atributo ou ajuste o alvo.";
        elements.calculatorResults.appendChild(empty);
        if (plan.missingAfterPlan > 0) {
            const warning = document.createElement("p");
            warning.className = "calculator-warning";
            warning.textContent = plan.budgetBlocked
                ? `Seu limite de gold impediu novas etapas. Ainda faltam ${formatAttributeValue(
                      plan.attribute,
                      plan.missingAfterPlan,
                  )} para atingir o alvo.`
                : missingGoldOnly
                  ? `Ainda faltam ${formatAttributeValue(
                        plan.attribute,
                        plan.missingAfterPlan,
                    )} para atingir o alvo. Defina o gold dos selos elegiveis para continuar.`
                : `Ainda faltam ${formatAttributeValue(
                      plan.attribute,
                      plan.missingAfterPlan,
                  )} para atingir o alvo.`;
            elements.calculatorResults.appendChild(warning);
        }
        return;
    }

    const list = document.createElement("div");
    const subtleLine = document.createElement("p");
    subtleLine.className = "calculator-inline-note";
    subtleLine.textContent =
        plan.openersToBuy > 0
            ? `Voce ja cobre ${formatThreshold(plan.openersOwnedUsed)} opener(s) do plano e precisa comprar ${formatThreshold(plan.openersToBuy)}.`
            : `Voce ja cobre ${formatThreshold(plan.openersOwnedUsed)} opener(s) adicionais do plano.`;
    elements.calculatorResults.appendChild(subtleLine);

    list.className = "calculator-plan-list";
    plan.entries.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "calculator-plan-card";
        const projectedValueClass = entry.projectedValue > entry.currentValue ? "calculator-plan-card__projected" : "";
        const efficiencyLabel =
            plan.strategyUsed === "openers"
                ? "Openers/ponto"
                : plan.strategyUsed === "ultra"
                ? "Gold/ponto"
                : plan.strategyUsed === "seals"
                ? "Selos/ponto"
                : entry.goldPerPoint > 0
                  ? "Custo/ponto"
                  : "Selos/ponto";
        const efficiencyValue =
            plan.strategyUsed === "openers"
                ? `${formatDecimal(entry.openersNeeded / Math.max(entry.gain, 0.0001))}`
                : plan.strategyUsed === "ultra"
                ? `${formatGoldText(formatGoldDisplay(entry.goldPerPoint, { zeroAsValue: true }))}`
                : plan.strategyUsed === "seals"
                ? `${formatDecimal(entry.sealsPerPoint)}`
                : entry.goldPerPoint > 0
                  ? `${formatGoldText(formatGoldDisplay(entry.goldPerPoint, { zeroAsValue: true }))}`
                  : `${formatDecimal(entry.sealsPerPoint)}`;
        card.innerHTML = `
            <div class="calculator-plan-card__header">
                <div>
                    <p class="calculator-plan-card__title">${entry.name}</p>
                    <p class="calculator-plan-card__meta">${formatAttributeValue(
                        entry.attribute,
                        entry.currentValue,
                    )} -> <span class="${projectedValueClass}">${formatAttributeValue(
                        entry.attribute,
                        entry.projectedValue,
                    )}</span></p>
                </div>
                <span class="attribute-badge" data-attribute="${String(entry.attribute || "").toUpperCase()}">${entry.attribute}</span>
            </div>
            <div class="calculator-plan-card__body">
                <div class="calculator-plan-card__row calculator-plan-card__row--quantity">
                    <span>Qtd</span>
                    <strong class="calculator-plan-card__quantity">${formatThreshold(
                        entry.currentQuantity,
                    )}/${formatThreshold(entry.targetQuantity)}</strong>
                </div>
                <div class="calculator-plan-card__row">
                    <span>Ganho</span>
                    <strong>+${formatAttributeValue(entry.attribute, entry.gain)}</strong>
                </div>
                <div class="calculator-plan-card__row">
                    <span>Falta</span>
                    <strong>${formatThreshold(entry.sealsNeeded)} selos | ${formatAdditionalOpenersText(entry.openersNeeded)}</strong>
                </div>
                <div class="calculator-plan-card__row">
                    <span>${efficiencyLabel}</span>
                    <strong>${efficiencyValue}</strong>
                </div>
                <div class="calculator-plan-card__row calculator-plan-card__row--gold">
                    <span>Gold</span>
                    <strong class="calculator-plan-card__gold" ${
                        entry.unitCost > 0 ? 'data-gold-breakdown="' + entry.goldNeeded + '"' : ""
                    }>${entry.unitCost > 0 ? "" : "Sem gold"}</strong>
                </div>
            </div>
        `;
        const actions = document.createElement("div");
        actions.className = "calculator-plan-card__actions";
        const doneBtn = document.createElement("button");
        doneBtn.type = "button";
        doneBtn.className = "ghost-btn ghost-btn--sm ghost-btn--primary";
        doneBtn.textContent = `Aplicar +${formatThreshold(entry.sealsNeeded)}`;
        doneBtn.addEventListener("click", () => applyPlanToTemplate(entry.template || { id: entry.id, name: entry.name }, entry));
        actions.appendChild(doneBtn);
        const isBlocked = getBlockedTemplateSet().has(entry.id);
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = isBlocked ? "ghost-btn ghost-btn--sm ghost-btn--primary" : "ghost-btn ghost-btn--sm ghost-btn--danger-outline";
        toggleBtn.textContent = "X";
        toggleBtn.title = isBlocked ? "Reincluir no plano" : "Remover do plano";
        toggleBtn.setAttribute("aria-label", isBlocked ? "Reincluir no plano" : "Remover do plano");
        toggleBtn.addEventListener("click", () => toggleTemplateBlocked(entry.id));
        actions.appendChild(toggleBtn);
        if (isBlocked) {
            const badge = document.createElement("span");
            badge.className = "badge badge--muted";
            badge.textContent = "Removido do plano";
            actions.appendChild(badge);
        }
        card.appendChild(actions);
        list.appendChild(card);
    });
    elements.calculatorResults.appendChild(list);

    // Render gold breakdown after nodes are in the DOM
    elements.calculatorResults.querySelectorAll("[data-gold-breakdown]").forEach((node) => {
        const value = parseNumber(node.dataset.goldBreakdown);
        const breakdown = formatGoldBreakdown(value);
        renderGoldInline(node, breakdown);
    });

    if (plan.missingAfterPlan > 0 && plan.singleSealSuggestion) {
        const suggestion = plan.singleSealSuggestion;
        const display = formatGoldDisplay(suggestion.cost);
        const suggestionCostText =
            suggestion.cost > 0
                ? `por ${formatGoldText(display)}`
                : "com melhor ganho imediato";
        const suggestionBlock = document.createElement("div");
        suggestionBlock.className = "calculator-suggestion";
        suggestionBlock.innerHTML = `
            <p class="calculator-suggestion__title">Sugestao rapida: comprar 1 selo</p>
            <p class="calculator-suggestion__text">
                ${suggestion.template.name} rende +${formatAttributeValue(
                    plan.attribute,
                    suggestion.gain,
                )} ${suggestionCostText}. Atual: ${formatThreshold(
                    suggestion.currentQuantity,
                )} selos -> depois: ${formatThreshold(
                    suggestion.currentQuantity + 1,
                )}.
            </p>
        `;
        if (suggestion.cost > 0) {
            const goldInline = document.createElement("span");
            goldInline.className = "calculator-suggestion__gold";
            renderGoldInline(goldInline, formatGoldBreakdown(suggestion.cost));
            suggestionBlock.appendChild(goldInline);
        }
        elements.calculatorResults.appendChild(suggestionBlock);
    }

    if (plan.missingAfterPlan > 0) {
        const warning = document.createElement("p");
        warning.className = "calculator-warning";
        warning.textContent = plan.budgetBlocked
            ? `O plano parou no limite de gold informado. Ainda faltam ${formatAttributeValue(
                  plan.attribute,
                  plan.missingAfterPlan,
              )} para atingir o alvo.`
            : `Mesmo completando o plano ainda faltam ${formatAttributeValue(
                  plan.attribute,
                  plan.missingAfterPlan,
              )} para atingir o alvo.`;
        elements.calculatorResults.appendChild(warning);
    }
}

function updateCalculatorSummary(plan = null) {
    const attribute = state.calculatorAttribute || (state.attributes[0] || "AT");
    const currentSnapshot = calculateCurrentAttributeTotal(attribute);
    const currentValue =
        plan && plan.currentTotal !== undefined ? plan.currentTotal : currentSnapshot.total;

    if (elements.calculatorCurrentStat) {
        elements.calculatorCurrentStat.textContent = formatAttributeValue(attribute, currentValue);
    }
    if (elements.calculatorOpenersTotal) {
        elements.calculatorOpenersTotal.textContent = plan
            ? formatThreshold(plan.totalOpeners)
            : "--";
    }
    if (elements.calculatorAccountLabel) {
        elements.calculatorAccountLabel.textContent = getActiveAccount() || "Nenhuma";
    }
}

function openAccountManagerModal() {
    if (!elements.accountManagerModal) {
        return;
    }
    if (!state.accounts.length) {
        showToast("Nenhum perfil de jogo cadastrado para gerenciar.", "warning");
        return;
    }
    syncAccountManagerControls();
    elements.accountManagerModal.classList.remove("hidden");
    elements.accountManagerModal.setAttribute("aria-hidden", "false");
}

function closeAccountManagerModal() {
    if (!elements.accountManagerModal) {
        return;
    }
    elements.accountManagerModal.classList.add("hidden");
    elements.accountManagerModal.setAttribute("aria-hidden", "true");
}

async function handleAccountTabDelete(accountName) {
    if (!accountName) return;
    const confirmed = window.confirm(
        `Excluir o perfil de jogo "${accountName}" vai remover os selos, preços e configurações vinculados. Deseja continuar?`
    );
    if (!confirmed) return;
    try {
        const payload = await apiDeleteAccount(accountName);
        clearStoredCalculatorOpenerPricePreferencesForAccount(accountName);
        applyAccountPayload(payload, payload.account);
        showToast(payload.message || "Perfil de jogo removido com sucesso.");
        if (state.account) {
            await loadAccountSeals(state.account);
        } else {
            state.mySeals = [];
            renderAccountSeals();
            renderTemplates();
            refreshCalculator();
        }
    } catch (error) {
        showToast(error.message || "Falha ao excluir o perfil de jogo.", "error");
    }
}

async function handleAccountCreate() {
    const name = window.prompt("Informe o nome do novo perfil de jogo:");
    const trimmed = name ? name.trim() : "";
    if (!trimmed) {
        return;
    }
    try {
        const payload = await apiCreateAccount(trimmed);
        applyAccountPayload(payload, payload.account || trimmed);
        showToast(payload.message || "Perfil de jogo criado com sucesso.");
        await loadAccountSeals(state.account);
        syncAccountManagerControls();
    } catch (error) {
        showToast(error.message || "Falha ao criar o perfil de jogo.", "error");
    }
}

function startAccountInlineEdit(tab) {
    if (!tab || tab.dataset.editing === "true") {
        return;
    }
    const currentName = tab.dataset.account;
    const label = tab.querySelector(".account-tab__label");
    const close = tab.querySelector(".account-tab__close");
    if (!label || !currentName) {
        return;
    }
    tab.dataset.editing = "true";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "account-tab__input";
    input.value = currentName;
    input.setAttribute("aria-label", "Renomear perfil de jogo");
    label.replaceWith(input);
    if (close) {
        close.style.display = "none";
    }
    input.focus();
    input.select();

    let submitting = false;

    const restore = () => {
        if (tab.dataset.editing !== "true") return;
        tab.dataset.editing = "false";
        if (input.parentNode) {
            input.replaceWith(label);
        }
        if (close) {
            close.style.display = "";
        }
    };

    const commit = async () => {
        if (submitting) return;
        const newName = input.value.trim();
        if (!newName || newName === currentName) {
            restore();
            return;
        }
        submitting = true;
        try {
            const payload = await apiRenameAccount(currentName, newName);
            migrateStoredCalculatorOpenerPricePreference(currentName, payload.account || newName);
            applyAccountPayload(payload, payload.account || newName);
            showToast(payload.message || "Perfil de jogo renomeado com sucesso.");
            await loadAccountSeals(state.account);
        } catch (error) {
            showToast(error.message || "Falha ao renomear o perfil de jogo.", "error");
        } finally {
            submitting = false;
            syncAccountControls();
        }
    };

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            restore();
        }
    });
    input.addEventListener("blur", () => {
        if (!submitting) {
            restore();
        }
    });
}

function openSealModal(template = null) {
    if (!elements.sealModal) return;
    if (template) {
        prepareTemplateEdit(template);
    } else {
        resetTemplateForm();
    }
    elements.sealModal.classList.remove("hidden");
    elements.sealModal.setAttribute("aria-hidden", "false");
}

function closeSealModal() {
    if (!elements.sealModal) return;
    closeSealDefaultsModal();
    elements.sealModal.classList.add("hidden");
    elements.sealModal.setAttribute("aria-hidden", "true");
    resetTemplateForm();
}

function openSealDefaultsModal() {
    if (!elements.sealDefaultsModal) {
        return;
    }
    state.sealDefaultsDraft = cloneSealDefaultsConfig(state.defaults);
    state.sealDefaultsDraftPatternId = state.sealDefaultsDraft.activePatternId;
    renderSealDefaultsPatternOptions();
    fillSealDefaultsForm();
    elements.sealDefaultsModal.classList.remove("hidden");
    elements.sealDefaultsModal.setAttribute("aria-hidden", "false");
}

function closeSealDefaultsModal() {
    if (!elements.sealDefaultsModal) {
        return;
    }
    elements.sealDefaultsModal.classList.add("hidden");
    elements.sealDefaultsModal.setAttribute("aria-hidden", "true");
    state.sealDefaultsDraft = null;
    state.sealDefaultsDraftPatternId = null;
}

function openGoldModal(template) {
    if (!elements.goldModal || !elements.goldModalCostInput) {
        return;
    }
    const currentTemplate = state.templates.find(
        (item) => parseInteger(item.id) === parseInteger(template?.id),
    );
    template = currentTemplate || template;
    state.goldModalTemplate = template;
    state.goldModalServer = getCurrentServerKey();
    const activeAccount = getActiveAccount();
    const accountSeal = state.mySeals.find(
        (entry) => entry.sealId === template.id && entry.account === activeAccount,
    );
    state.goldModalAccountSeal = accountSeal || null;
    clearGoldModalSourceSelection();
    if (elements.goldModalSourceUserInput) {
        elements.goldModalSourceUserInput.value = "";
    }
    if (elements.goldModalAdminSource) {
        elements.goldModalAdminSource.classList.toggle("hidden", !state.isAdmin);
    }
    updateGoldModalSyncButtonState();
    if (state.isAdmin) {
        ensureAdminUsersLoaded().catch(() => {
            // Mantem o modal utilizavel mesmo se a busca de usuarios falhar.
        });
    }
    const accountCost = getAccountUnitCost(accountSeal, template, state.goldModalServer);
    const templateCost = getTemplateUnitCost(template, state.goldModalServer) || 0;
    const costValue = accountCost !== undefined && accountCost !== null ? accountCost : templateCost;
    elements.goldModalCostInput.value = costValue ? formatGoldCompactValue(costValue) : "";
    updateGoldInputHint(elements.goldModalCostInput, elements.goldModalCostHint, {
        defaultUnitKey: "M",
    });
    if (elements.goldModalTitle) {
        elements.goldModalTitle.textContent = `Editar gold (${getCurrentServerLabel()}) - ${template.name}`;
    }
    elements.goldModal.classList.remove("hidden");
    elements.goldModal.setAttribute("aria-hidden", "false");
}

function closeGoldModal() {
    if (!elements.goldModal) return;
    state.goldModalTemplate = null;
    state.goldModalServer = null;
    state.goldModalAccountSeal = null;
    clearGoldModalSourceSelection();
    if (elements.goldModalSourceUserInput) {
        elements.goldModalSourceUserInput.value = "";
    }
    if (elements.goldModalSyncBtn) {
        elements.goldModalSyncBtn.disabled = true;
        elements.goldModalSyncBtn.textContent = "Usar meu gold no global";
    }
    if (elements.goldModalSyncAllBtn) {
        elements.goldModalSyncAllBtn.disabled = true;
        elements.goldModalSyncAllBtn.textContent = "Puxar todos do usuario";
    }
    elements.goldModal.classList.add("hidden");
    elements.goldModal.setAttribute("aria-hidden", "true");
}

function handleGoldModalSync() {
    if (!state.goldModalTemplate) {
        showToast("Nenhum selo selecionado para sincronizar.", "warning");
        return;
    }
    const selectedSourceValue = getGoldModalSourceUserValue();
    if (selectedSourceValue) {
        const selectedUser = getGoldModalSelectedSourceUser();
        if (!selectedUser) {
            showToast("Selecione um usuario valido para copiar o gold.", "warning");
            return;
        }
        const account = getGoldModalSourceAccountValue();
        if (!account) {
            showToast("Selecione o perfil de jogo do usuario escolhido.", "warning");
            return;
        }
        syncGoldFromSelectedUser(state.goldModalTemplate, selectedUser, account);
        return;
    }
    if (
        !state.goldModalAccountSeal ||
        state.goldModalAccountSeal.unitCost === undefined ||
        state.goldModalAccountSeal.unitCost === null
    ) {
        showToast("Defina o gold do selo no perfil de jogo ativo antes de copiar.", "warning");
        return;
    }
    syncGoldFromAccount(state.goldModalTemplate, state.goldModalAccountSeal);
}

function handleGoldModalSyncAll() {
    if (!state.goldModalTemplate) {
        showToast("Nenhum selo selecionado para sincronizar.", "warning");
        return;
    }
    const selectedUser = getGoldModalSelectedSourceUser();
    if (!selectedUser) {
        showToast("Selecione um usuario valido para puxar todos os golds.", "warning");
        return;
    }
    syncAllGoldFromSelectedUser(selectedUser);
}

function closeProfileModal() {
    if (!elements.profileModal) return;
    elements.profileModal.classList.add("hidden");
    elements.profileModal.setAttribute("aria-hidden", "true");
}

function calculateGoldModalCost() {
    if (!elements.goldModalCostInput) {
        return null;
    }
    return parseGoldInputValue(elements.goldModalCostInput.value, { defaultUnitKey: "M" });
}

function getAccountSealUnitCostFromInput() {
    if (!elements.accountSealUnitCostInput) return null;
    return parseGoldInputValue(elements.accountSealUnitCostInput.value, { defaultUnitKey: "M" });
}

async function openAccountSealModal(editEntry = null) {
    const options = typeof editEntry === "object" && editEntry !== null ? editEntry : {};
    const entry = options.entry || (options.id && options.sealId ? options : null);
    const templateId = options.templateId || (entry ? entry.sealId : null);
    const templateData = options.templateData || (entry ? entry.template : null);
    const accountOverride = options.accountOverride || (entry ? entry.account : null);

    if (!elements.accountSealModal) return;

    const activeAccount = accountOverride || getActiveAccount();
    if (!activeAccount) {
        showToast("Selecione um perfil de jogo antes de adicionar quantidade.", "warning");
        return;
    }

    if (!templateData) {
        try {
            await ensureTemplateCatalogComplete();
        } catch (error) {
            showToast(error.message || "Nao foi possivel carregar a lista de selos.", "error");
            return;
        }
    }
    if (!state.templates.length && !templateData) {
        showToast("Cadastre um selo antes de adicionar aos Meus Selos.", "warning");
        return;
    }

    state.accountSealMode = entry ? "edit" : "create";
    state.accountSealEditingId = entry ? entry.id : null;
    if (elements.accountSealForm) {
        elements.accountSealForm.reset();
    }

    const lockAccount = Boolean(accountOverride) || Boolean(entry);
    if (elements.accountSealAccountInput) {
        elements.accountSealAccountInput.value = activeAccount;
        elements.accountSealAccountInput.readOnly = lockAccount;
    }

    syncTemplateSelect();
    const finalTemplateId = templateId;
    if (elements.accountSealTemplateSelect) {
        if (finalTemplateId && templateData) {
            const exists = [...elements.accountSealTemplateSelect.options].some(
                (opt) => parseInt(opt.value, 10) === finalTemplateId,
            );
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = finalTemplateId;
                opt.textContent = `${templateData.attribute || ""} - ${templateData.name || "Selo"}`;
                elements.accountSealTemplateSelect.appendChild(opt);
            }
        }
        if (finalTemplateId) {
            elements.accountSealTemplateSelect.value = String(finalTemplateId);
            elements.accountSealTemplateSelect.disabled = true;
        } else {
            elements.accountSealTemplateSelect.disabled = false;
        }
    }

    if (elements.accountSealQuantityInput) {
        elements.accountSealQuantityInput.value = entry ? entry.quantity : "";
    }
    if (elements.accountSealUnitCostInput) {
        const templateCost = templateData ? getTemplateUnitCost(templateData) : null;
        const cost = entry && entry.unitCost ? entry.unitCost : templateCost || "";
        elements.accountSealUnitCostInput.value = cost === "" ? "" : formatGoldCompactValue(cost);
        updateGoldInputHint(
            elements.accountSealUnitCostInput,
            elements.accountSealUnitCostHint,
            { defaultUnitKey: "M" },
        );
    }

    if (elements.accountSealModal.querySelector("#accountSealModalTitle")) {
        elements.accountSealModal.querySelector("#accountSealModalTitle").textContent = entry
            ? "Editar My Seal"
            : "Vincular template ao perfil de jogo";
    }
    elements.accountSealModal.classList.remove("hidden");
    elements.accountSealModal.setAttribute("aria-hidden", "false");
}

function closeAccountSealModal() {
    if (!elements.accountSealModal) return;
    elements.accountSealModal.classList.add("hidden");
    elements.accountSealModal.setAttribute("aria-hidden", "true");
    state.accountSealMode = "create";
    state.accountSealEditingId = null;
    if (elements.accountSealAccountInput) {
        elements.accountSealAccountInput.readOnly = false;
    }
    if (elements.accountSealTemplateSelect) {
        elements.accountSealTemplateSelect.disabled = false;
    }
}

function setTemplateSubmitLabel(text) {
    if (!elements.sealForm) return;
    const submitButton = elements.sealForm.querySelector('button[type="submit"]');
    if (submitButton && text) {
        submitButton.textContent = text;
    }
}

function setInputValue(input, value) {
    if (!input) return;
    input.value = value === undefined || value === null ? "" : String(value);
}

function setNumericInputValue(input, value, options = {}) {
    if (!input) return;
    const numeric = parseNumber(value);
    if (numeric === null) {
        input.value = "";
        return;
    }
    if (Number.isInteger(options.decimals)) {
        input.value = roundNumber(numeric, options.decimals).toFixed(options.decimals);
        return;
    }
    input.value = String(numeric);
}

function getSealValueInputDecimals(attribute) {
    return isPercentAttribute(attribute) ? 2 : null;
}

function getPreferredTemplateAttribute() {
    const currentFilter = String(state.attributeFilter || "TODOS").toUpperCase();
    if (currentFilter !== "TODOS") {
        const matchingAttribute = state.attributes.find(
            (attribute) => String(attribute || "").toUpperCase() === currentFilter
        );
        if (matchingAttribute) {
            return matchingAttribute;
        }
    }
    return null;
}

function resetTemplateForm() {
    if (elements.sealForm) {
        elements.sealForm.reset();
    }
    state.templateMode = "create";
    state.templateEditingId = null;
    state.templatePatternId = state.defaults.activePatternId;
    if (elements.sealModalTitle) {
        elements.sealModalTitle.textContent = "Adicionar Selo";
    }
    setTemplateSubmitLabel("Salvar template");
    const preferredAttribute = getPreferredTemplateAttribute();
    if (elements.sealAttributeSelect && preferredAttribute) {
        elements.sealAttributeSelect.value = preferredAttribute;
    }
    applyDefaultThresholds();
    applyDefaultPercentages();
    state.levels.forEach((level) => autoFillValueFromPercent(level));
    renderTemplatePatternHint();
}

function prepareTemplateEdit(template) {
    if (!template || !template.id) {
        resetTemplateForm();
        return;
    }
    if (elements.sealForm) {
        elements.sealForm.reset();
    }
    state.templateMode = "edit";
    state.templateEditingId = template.id;
    state.templatePatternId = null;
    if (elements.sealModalTitle) {
        elements.sealModalTitle.textContent = "Editar Selo";
    }
    setTemplateSubmitLabel("Salvar alteracoes");
    setInputValue(elements.sealNameInput, template ? template.name : "");
    const templateAttribute = normalizeAttributeKey(template ? template.attribute : "");
    if (elements.sealAttributeSelect && templateAttribute) {
        elements.sealAttributeSelect.value = templateAttribute;
    }
    setNumericInputValue(elements.sealBaseValueInput, template ? template.baseValue : "", {
        decimals: getSealValueInputDecimals(templateAttribute),
    });
    const levels = (template && template.levels) || {};
    state.levels.forEach((level) => {
        const info = levels[level] || {};
        setInputValue(getLevelInput(level, "threshold"), info.threshold);
        setInputValue(getLevelInput(level, "percentage"), info.percentage);
        setNumericInputValue(getLevelInput(level, "value"), info.value, {
            decimals: getSealValueInputDecimals(templateAttribute),
        });
    });
    syncTemplatePatternFromForm();
}

function applyDefaultThresholds(force = false) {
    const pattern = getSealPatternById(state.defaults, state.templatePatternId) || getActiveSealPattern();
    state.levels.forEach((level) => {
        const thresholdInput = getLevelInput(level, "threshold");
        if (thresholdInput && (force || !thresholdInput.value) && pattern && pattern.thresholds[level] !== undefined) {
            thresholdInput.value = pattern.thresholds[level];
        }
    });
}

function applyDefaultPercentages(force = false) {
    const pattern = getSealPatternById(state.defaults, state.templatePatternId) || getActiveSealPattern();
    state.levels.forEach((level) => {
        const percentInput = getLevelInput(level, "percentage");
        if (percentInput && (force || !percentInput.value) && pattern && pattern.percentages[level] !== undefined) {
            percentInput.value = pattern.percentages[level];
        }
    });
}

function getLevelInput(level, field) {
    return document.querySelector(`[data-level-field="${field}"][data-level="${level}"]`);
}

function autoFillValueFromPercent(level) {
    const percentInput = getLevelInput(level, "percentage");
    const valueInput = getLevelInput(level, "value");
    if (!percentInput || !valueInput || !elements.sealBaseValueInput) {
        return;
    }
    const baseValue = parseNumber(elements.sealBaseValueInput.value);
    const percent = parseNumber(percentInput.value);
    if (baseValue === null || percent === null) {
        return;
    }
    const computed = (baseValue * percent) / 100;
    if (Number.isFinite(computed)) {
        const decimals = getSealValueInputDecimals(getAttributeType());
        valueInput.value = decimals === null
            ? String(roundNumber(computed, 0))
            : roundNumber(computed, decimals).toFixed(decimals);
    }
}

function autoFillPercentFromValue(level) {
    const percentInput = getLevelInput(level, "percentage");
    const valueInput = getLevelInput(level, "value");
    if (!percentInput || !valueInput || !elements.sealBaseValueInput) {
        return;
    }
    const baseValue = parseNumber(elements.sealBaseValueInput.value);
    const value = parseNumber(valueInput.value);
    if (baseValue === null || baseValue === 0 || value === null) {
        return;
    }
    const percent = (value / baseValue) * 100;
    if (Number.isFinite(percent)) {
        percentInput.value = roundNumber(percent, 2);
    }
}

function getAttributeType() {
    return normalizeAttributeKey(elements.sealAttributeSelect ? elements.sealAttributeSelect.value : "AT");
}

function getTemplateOrderIds() {
    return state.templates.map((template) => template.id);
}

function buildReorderedOrder(orderIds, fromId, toId) {
    const list = Array.isArray(orderIds) ? orderIds.slice() : [];
    const fromNumeric = parseInteger(fromId);
    const toNumeric = parseInteger(toId);
    const fromIndex = list.indexOf(fromNumeric);
    const toIndex = list.indexOf(toNumeric);
    if (fromIndex === -1 || toIndex === -1) {
        return null;
    }
    const next = list.slice();
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
}

function setTemplateOrder(orderIds) {
    const orderMap = new Map();
    orderIds.forEach((id, idx) => {
        const numeric = parseInteger(id);
        if (numeric !== null) {
            orderMap.set(numeric, idx + 1);
        }
    });
    state.templates = state.templates.map((template, idx) => {
        const fallback = template.orderIndex || idx + 1000;
        const orderIndex = orderMap.get(template.id) || fallback;
        return { ...template, orderIndex };
    });
    sortTemplatesInState();
    const templateOrderMap = new Map(state.templates.map((tpl) => [tpl.id, tpl.orderIndex || 0]));
    state.mySeals = state.mySeals.map((entry) => {
        const template = entry.template || {};
        const orderIndex = templateOrderMap.get(template.id);
        if (!orderIndex) {
            return entry;
        }
        return { ...entry, template: { ...template, orderIndex } };
    });
    sortAccountSeals();
    renderTemplates();
    renderAccountSeals();
    refreshCalculator();
}

async function persistTemplateOrder(orderIds) {
    const response = await fetch("/api/seals/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderIds }),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || "Erro ao salvar a ordem dos templates.");
    }
    clearSealsApiCache();
    if (Array.isArray(payload.templates)) {
        state.templates = normalizeSealTemplates(payload.templates);
        sortTemplatesInState();
        const orderMap = new Map(state.templates.map((tpl) => [tpl.id, tpl.orderIndex || 0]));
        state.mySeals = state.mySeals.map((entry) => {
            const template = entry.template || {};
            const orderIndex = orderMap.get(template.id);
            return orderIndex ? { ...entry, template: { ...template, orderIndex } } : entry;
        });
        sortAccountSeals();
        renderTemplates();
        renderAccountSeals();
    }
    showToast(payload.message || "Ordem dos selos atualizada.");
}

async function applyTemplateOrder(orderIds) {
    const normalized = Array.from(new Set(orderIds.map((id) => parseInteger(id)).filter((id) => id !== null)));
    if (!normalized.length) {
        return;
    }
    setTemplateOrder(normalized);
    try {
        await persistTemplateOrder(normalized);
    } catch (error) {
        showToast(error.message || "Falha ao salvar ordem dos selos.", "error");
        await loadTemplates();
        if (state.account) {
            await loadAccountSeals(state.account);
        }
    }
}

function toggleTemplateBlocked(templateId) {
    const id = parseInteger(templateId);
    if (id === null) return;
    const blocked = Array.isArray(state.blockedTemplates) ? [...state.blockedTemplates] : [];
    const idx = blocked.findIndex((value) => parseInteger(value) === id);
    if (idx >= 0) {
        blocked.splice(idx, 1);
    } else {
        blocked.push(id);
    }
    state.blockedTemplates = blocked;
    if (window.LocalSealsApi) {
        window.LocalSealsApi.saveBlocked(getActiveAccount(), getCurrentServerKey(), blocked);
    }
    runCalculatorWithFullCatalog();
    renderTemplates();
}

async function applyPlanToTemplate(template, entry = null) {
    const targetEntry = entry || (state.calculatorPlan?.entries || []).find((item) => item.id === template.id);
    if (!targetEntry || !targetEntry.sealsNeeded) {
        showToast("Nenhum plano calculado para este selo.", "warning");
        return;
    }
    const account = getActiveAccount();
    if (!account) {
        showToast("Selecione um perfil de jogo antes de aplicar o plano.", "warning");
        return;
    }
    const currentEntry = state.mySeals.find(s => s.sealId === template.id && s.account === account);
    const currentQuantity = currentEntry ? currentEntry.quantity || 0 : 0;
    const addQuantity = targetEntry.sealsNeeded;
    const { maxThreshold } = computeTemplateMax(template || {});
    let newQuantity = currentQuantity + addQuantity;
    if (maxThreshold && newQuantity > maxThreshold) {
        newQuantity = maxThreshold;
        showToast(
            `Limite maximo do selo: ${formatThreshold(maxThreshold)} selos. Ajustamos a quantidade.`,
            "warning",
        );
    }
    const spendState = getAppliedPlanSpendState(
        currentQuantity,
        newQuantity,
        getAccountUnitCost(currentEntry, template),
        state.openersOwned,
        parseGoldInputValue(state.openerPrice, { defaultUnitKey: "M" }) || 0,
    );
    try {
        const response = await fetch("/api/account-seals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                account,
                sealId: template.id,
                quantity: newQuantity,
                unitCost: getTemplateUnitCost(template) ?? null,
                serverKey: getCurrentServerKey(),
            }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao salvar o My Seal.");
        }
        showToast(payload.message || "My Seal atualizado com sucesso.");
        applyConsumedCalculatorResources(spendState);
        state.account = account;
        await loadAccountSeals(account);
        await runCalculatorWithFullCatalog();
    } catch (error) {
        showToast(error.message || "Falha ao aplicar o plano para este selo.", "error");
    }
}

async function syncGoldFromAccount(template, accountSeal) {
    if (!state.isAdmin) {
        showToast("Apenas admins podem atualizar o gold global.", "warning");
        return;
    }
    const account = accountSeal?.account || getActiveAccount();
    if (!account) {
        showToast("Selecione um perfil de jogo para copiar o valor.", "warning");
        return;
    }
    if (!accountSeal || accountSeal.unitCost === undefined || accountSeal.unitCost === null) {
        showToast("Defina um gold para este selo no seu perfil de jogo antes de copiar.", "warning");
        return;
    }
    try {
        const response = await fetch(`/api/seals/${template.id}/gold/sync-from-account`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account, serverKey: getCurrentServerKey() }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao atualizar o gold global.");
        }
        clearSealsApiCache();
        showToast(payload.message || "Gold global atualizado a partir do perfil de jogo.");
        await loadTemplates();
        if (state.account) {
            await loadAccountSeals(state.account);
        } else {
            renderAccountSeals();
        }
        state.goldModalTemplate = state.templates.find((item) => item.id === template.id) || template;
        const activeAccount = getActiveAccount();
        state.goldModalAccountSeal =
            state.mySeals.find((entry) => entry.sealId === template.id && entry.account === activeAccount) || null;
        updateGoldModalSyncButtonState();
    } catch (error) {
        showToast(error.message || "Erro ao atualizar gold global.", "error");
    }
}

async function syncGoldFromSelectedUser(template, sourceUser, account) {
    if (!state.isAdmin) {
        showToast("Apenas admins podem atualizar o gold global.", "warning");
        return;
    }
    if (!sourceUser || !sourceUser.id) {
        showToast("Selecione um usuario valido para copiar o gold.", "warning");
        return;
    }
    if (!account) {
        showToast("Selecione o perfil de jogo do usuario escolhido.", "warning");
        return;
    }
    try {
        const response = await fetch(`/api/seals/${template.id}/gold/sync-from-account`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                account,
                serverKey: getCurrentServerKey(),
                sourceUserId: sourceUser.id,
            }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao atualizar o gold global.");
        }
        clearSealsApiCache();
        showToast(payload.message || `Gold global atualizado a partir de ${sourceUser.email}.`);
        await loadTemplates();
        if (state.account) {
            await loadAccountSeals(state.account);
        } else {
            renderAccountSeals();
        }
        state.goldModalTemplate = state.templates.find((item) => item.id === template.id) || template;
        const activeAccount = getActiveAccount();
        state.goldModalAccountSeal =
            state.mySeals.find((entry) => entry.sealId === template.id && entry.account === activeAccount) || null;
        updateGoldModalSyncButtonState();
    } catch (error) {
        showToast(error.message || "Erro ao atualizar gold global.", "error");
    }
}

async function syncAllGoldFromSelectedUser(sourceUser) {
    if (!state.isAdmin) {
        showToast("Apenas admins podem atualizar o gold global.", "warning");
        return;
    }
    if (!sourceUser || !sourceUser.id) {
        showToast("Selecione um usuario valido para puxar todos os golds.", "warning");
        return;
    }
    try {
        const response = await fetch("/api/seals/gold/sync-all-from-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sourceUserId: sourceUser.id,
                serverKey: getCurrentServerKey(),
            }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Falha ao atualizar todos os golds globais.");
        }
        clearSealsApiCache();
        showToast(payload.message || `Golds globais atualizados a partir de ${sourceUser.email}.`);
        if (Array.isArray(payload.templates)) {
            state.templates = normalizeSealTemplates(payload.templates);
            sortTemplatesInState();
            renderTemplates();
            syncTemplateSelect();
            refreshCalculator();
        } else {
            await loadTemplates();
        }
        if (state.account) {
            await loadAccountSeals(state.account);
        } else {
            renderAccountSeals();
        }
        updateGoldModalSyncButtonState();
    } catch (error) {
        showToast(error.message || "Erro ao atualizar todos os golds globais.", "error");
    }
}

function clearTemplateDragState() {
    state.draggingTemplateId = null;
    document.querySelectorAll(".seal-card").forEach((node) => {
        node.classList.remove("seal-card--dragging", "seal-card--drag-over");
    });
}

function attachTemplateDrag(card, template) {
    if (!state.isAdmin || !card || !template || !template.id) {
        return;
    }
    card.draggable = true;
    card.dataset.templateId = template.id;
    card.classList.add("seal-card--draggable");
    card.addEventListener("dragstart", (event) => {
        state.draggingTemplateId = template.id;
        card.classList.add("seal-card--dragging");
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
        }
    });
    card.addEventListener("dragend", () => {
        clearTemplateDragState();
    });
    card.addEventListener("dragover", (event) => {
        if (!state.draggingTemplateId || state.draggingTemplateId === template.id) {
            return;
        }
        event.preventDefault();
        card.classList.add("seal-card--drag-over");
    });
    card.addEventListener("dragleave", () => {
        card.classList.remove("seal-card--drag-over");
    });
    card.addEventListener("drop", async (event) => {
        event.preventDefault();
        const fromId = state.draggingTemplateId;
        clearTemplateDragState();
        if (!fromId || fromId === template.id) {
            return;
        }
        const list = getTemplateOrderIds();
        const nextOrder = buildReorderedOrder(list, fromId, template.id);
        if (nextOrder) {
            await applyTemplateOrder(nextOrder);
        }
    });
}

async function handleTemplateSubmit(event) {
    event.preventDefault();
    const isEdit = state.templateMode === "edit" && state.templateEditingId;
    const name = elements.sealNameInput ? elements.sealNameInput.value.trim() : "";
    const attribute = getAttributeType();
    const baseValue = parseNumber(elements.sealBaseValueInput ? elements.sealBaseValueInput.value : null);
    if (!name) {
        showToast("Informe o nome do selo.", "warning");
        return;
    }
    if (baseValue === null) {
        showToast("Informe o valor maximo.", "warning");
        return;
    }

    const submitButton = elements.sealForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    const body = {
        name,
        attribute,
        baseValue,
        levels: collectLevels(),
    };

    try {
        const response = await fetch(isEdit ? `/api/seals/${state.templateEditingId}` : "/api/seals", {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao salvar o template.");
        }
        clearSealsApiCache();
        showToast(payload.message || (isEdit ? "Template atualizado com sucesso." : "Template criado com sucesso."));
        closeSealModal();
        await loadTemplates();
        if (state.account) {
            await loadAccountSeals(state.account);
        }
    } catch (error) {
        showToast(error.message || "Falha ao salvar o selo.", "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

function collectSealDefaults() {
    persistCurrentSealDefaultsDraftPattern();
    const draft = cloneSealDefaultsConfig(getCurrentSealDefaultsConfig());
    draft.activePatternId = state.sealDefaultsDraftPatternId || draft.activePatternId;
    return draft;
}

function handleSealDefaultsPatternChange(event) {
    if (!state.sealDefaultsDraft) {
        return;
    }
    persistCurrentSealDefaultsDraftPattern();
    state.sealDefaultsDraftPatternId = event.target.value;
    state.sealDefaultsDraft.activePatternId = state.sealDefaultsDraftPatternId;
    renderSealDefaultsPatternOptions();
    fillSealDefaultsForm();
}

function handleCreateSealDefaultPattern() {
    if (!state.sealDefaultsDraft) {
        return;
    }
    persistCurrentSealDefaultsDraftPattern();
    const nextIndex = state.sealDefaultsDraft.patterns.length + 1;
    const basePattern = getCurrentDraftSealPattern() || getActiveSealPattern(state.defaults);
    const newPattern = normalizeSingleSealPattern(
        {
            id: createSealPatternId(),
            name: `Padrao ${nextIndex}`,
            thresholds: basePattern ? basePattern.thresholds : DEFAULT_LEVEL_THRESHOLDS,
            percentages: basePattern ? basePattern.percentages : DEFAULT_LEVEL_PERCENTAGES,
        },
        nextIndex - 1,
    );
    state.sealDefaultsDraft.patterns.push(newPattern);
    state.sealDefaultsDraftPatternId = newPattern.id;
    state.sealDefaultsDraft.activePatternId = newPattern.id;
    renderSealDefaultsPatternOptions();
    fillSealDefaultsForm();
}

function handleDeleteSealDefaultPattern() {
    if (!state.sealDefaultsDraft || state.sealDefaultsDraft.patterns.length <= 1) {
        showToast("Mantenha pelo menos um padrao salvo.", "warning");
        return;
    }
    const patternId = state.sealDefaultsDraftPatternId;
    const pattern = getCurrentDraftSealPattern();
    state.sealDefaultsDraft.patterns = state.sealDefaultsDraft.patterns.filter((item) => item.id !== patternId);
    const nextPattern = state.sealDefaultsDraft.patterns[0] || null;
    state.sealDefaultsDraftPatternId = nextPattern ? nextPattern.id : null;
    state.sealDefaultsDraft.activePatternId = state.sealDefaultsDraftPatternId;
    renderSealDefaultsPatternOptions();
    fillSealDefaultsForm();
    const removedName = pattern && pattern.name ? `"${pattern.name}"` : "selecionado";
    showToast(`Padrao ${removedName} removido.`);
}

function handleSealDefaultsReset() {
    const pattern = getCurrentDraftSealPattern();
    if (!pattern) {
        return;
    }
    pattern.thresholds = { ...DEFAULT_LEVEL_THRESHOLDS };
    pattern.percentages = { ...DEFAULT_LEVEL_PERCENTAGES };
    if (elements.sealDefaultsPatternNameInput && !elements.sealDefaultsPatternNameInput.value.trim()) {
        elements.sealDefaultsPatternNameInput.value = pattern.name || "";
    }
    fillSealDefaultsForm();
}

async function handleSealDefaultsSubmit(event) {
    event.preventDefault();
    if (!state.isAdmin) {
        showToast("Apenas admin pode alterar o padrao global.", "warning");
        return;
    }
    const submitButton = elements.sealDefaultsForm
        ? elements.sealDefaultsForm.querySelector('button[type="submit"]')
        : null;
    if (submitButton) {
        submitButton.disabled = true;
    }
    try {
        const defaultsPayload = collectSealDefaults();
        const response = await fetch("/api/admin/seal-defaults", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(defaultsPayload),
        });
        const payload = await response.json();
        if (!response.ok) {
            console.error("Falha ao salvar padrao global de selos.", {
                status: response.status,
                response: payload,
                request: defaultsPayload,
            });
            throw new Error(payload.error || "Erro ao salvar o padrao global.");
        }
        state.defaults = normalizeSealDefaultsConfig(payload.defaults);
        if (window.APP_CONFIG) {
            window.APP_CONFIG.sealDefaults = state.defaults;
        }
        state.templatePatternId = state.defaults.activePatternId;
        refreshSealDefaultPlaceholders();
        if (elements.sealModal && !elements.sealModal.classList.contains("hidden") && state.templateMode === "create") {
            applyDefaultThresholds(true);
            applyDefaultPercentages(true);
            state.levels.forEach((level) => autoFillValueFromPercent(level));
            renderTemplatePatternHint();
        }
        closeSealDefaultsModal();
        showToast(payload.message || "Padrao global atualizado.");
    } catch (error) {
        showToast(error.message || "Falha ao salvar o padrao global.", "error");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

async function handleTemplateDelete(template) {
    const target = template && typeof template === "object" ? template : null;
    if (!target || !target.id) {
        return;
    }
    const confirmed = window.confirm(
        `Excluir o template "${target.name || "Selo"}"? Essa acao remove os My Seals vinculados.`,
    );
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch(`/api/seals/${target.id}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao excluir o template.");
        }
        clearSealsApiCache();
        showToast(payload.message || "Template removido com sucesso.");
        if (state.templateEditingId === target.id) {
            closeSealModal();
        }
        await loadTemplates();
        if (state.account) {
            await loadAccountSeals(state.account);
        } else {
            state.mySeals = [];
            renderAccountSeals();
        }
    } catch (error) {
        showToast(error.message || "Falha ao excluir o selo.", "error");
    }
}

async function handleGoldModalSubmit(event) {
    event.preventDefault();
    const template = state.goldModalTemplate;
    if (!template) {
        return;
    }
    const unitCostRaw = elements.goldModalCostInput ? elements.goldModalCostInput.value.trim() : "";
    const unitCost = calculateGoldModalCost();
    if (unitCostRaw && unitCost === null) {
        showToast("Informe um gold valido. Ex.: 250B, 1,5M ou 2T.", "warning");
        return;
    }
    const submitButton = elements.goldModalForm ? elements.goldModalForm.querySelector('button[type="submit"]') : null;
    const submitButtonLabel = submitButton ? submitButton.textContent : "";
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Salvando...";
    }
    const optimisticCost = unitCost ?? 0;
    const serverKey = state.goldModalServer || getCurrentServerKey();
    const previousTemplates = state.templates;
    const previousMySeals = state.mySeals;
    const previousPersonalPrices = state.personalSealPrices;
    let optimisticApplied = false;
    try {
        if (!state.isAdmin) {
            const account = getActiveAccount();
            if (!account) {
                showToast("Selecione um perfil de jogo antes de salvar o gold.", "warning");
                return;
            }
            const entry = state.mySeals.find(
                (item) => item.sealId === template.id && item.account === account,
            );
            const quantity = Math.max(parseInteger(entry?.quantity) || 0, 0);
            setPersonalSealGoldInState(template.id, account, optimisticCost);
            optimisticApplied = true;
            if (entry && quantity > 0) {
                const response = await fetch(`/api/account-seals/${entry.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quantity, unitCost: optimisticCost, serverKey }),
                    keepalive: true,
                });
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || "Erro ao atualizar o gold do selo.");
                }
                if (payload.mySeal?.unitCost !== undefined && payload.mySeal?.unitCost !== null) {
                    setPersonalSealGoldInState(template.id, account, payload.mySeal.unitCost);
                }
            } else {
                const response = await fetch("/api/account-seals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        account,
                        sealId: template.id,
                        quantity,
                        unitCost: optimisticCost,
                        serverKey,
                    }),
                    keepalive: true,
                });
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || "Erro ao salvar o gold do selo.");
                }
                if (payload.mySeal?.unitCost !== undefined && payload.mySeal?.unitCost !== null) {
                    setPersonalSealGoldInState(template.id, account, payload.mySeal.unitCost);
                }
            }
            showToast("Gold atualizado com sucesso.");
            closeGoldModal();
            return;
        }
        setGlobalSealGoldInState(template.id, serverKey, optimisticCost);
        optimisticApplied = true;
        const response = await fetch(`/api/seals/${template.id}/gold`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unitCost: optimisticCost, serverKey }),
            keepalive: true,
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao atualizar o gold.");
        }
        clearSealsApiCache();
        if (payload.template) {
            setGlobalSealGoldInState(template.id, serverKey, optimisticCost, payload.template);
        }
        showToast(payload.message || "Gold atualizado com sucesso.");
        closeGoldModal();
    } catch (error) {
        if (optimisticApplied) {
            state.templates = previousTemplates;
            state.mySeals = previousMySeals;
            state.personalSealPrices = previousPersonalPrices;
            updateSingleSealGoldViews(template.id);
        }
        showToast(error.message || "Falha ao salvar o gold.", "error");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = submitButtonLabel;
        }
    }
}

async function handleAccountSealSubmit(event) {
    event.preventDefault();
    const account = elements.accountSealAccountInput ? elements.accountSealAccountInput.value.trim() : "";
    const sealId = parseInt(elements.accountSealTemplateSelect ? elements.accountSealTemplateSelect.value : "", 10);
    const quantity = parseInt(elements.accountSealQuantityInput ? elements.accountSealQuantityInput.value : "", 10);
    const unitCostRaw = elements.accountSealUnitCostInput ? elements.accountSealUnitCostInput.value.trim() : "";
    const unitCost = getAccountSealUnitCostFromInput();
    if (!account) {
        showToast("Informe o perfil de jogo.", "warning");
        return;
    }
    if (!Number.isInteger(sealId)) {
        showToast("Selecione um selo.", "warning");
        return;
    }
    const template = state.templates.find((tpl) => parseInteger(tpl.id) === sealId);
    if (!template) {
        showToast("Template nÃ‡Å“o encontrado.", "warning");
        return;
    }
    const { value: safeQty, capped, max } = clampQuantityToMax(template, quantity);
    if (!Number.isFinite(safeQty) || safeQty < 0) {
        showToast("Informe uma quantidade valida.", "warning");
        return;
    }
    if (unitCostRaw && unitCost === null) {
        showToast("Informe um gold valido. Ex.: 250B, 1,5M ou 2T.", "warning");
        return;
    }
    if (capped) {
        showToast(`Limite maximo do selo: ${formatThreshold(max)} selos. Ajustado para 100%.`, "warning");
    }

    const submitButton = elements.accountSealForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        if (state.accountSealMode === "edit" && state.accountSealEditingId) {
            await updateAccountSeal(state.accountSealEditingId, safeQty, account, unitCost);
        } else {
            const response = await fetch("/api/account-seals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account,
                    sealId,
                    quantity: safeQty,
                    unitCost,
                    serverKey: getCurrentServerKey(),
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Erro ao salvar o My Seal.");
            }
            showToast(payload.message || "My Seal salvo com sucesso.");
            closeAccountSealModal();
            state.account = account;
            syncAccountControls();
            await loadAccountSeals(account);
        }
    } catch (error) {
        showToast(error.message || "Falha ao salvar o My Seal.", "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

async function updateAccountSeal(recordId, quantity, account, unitCost = null, serverKey = null) {
    const response = await fetch(`/api/account-seals/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, unitCost, serverKey: serverKey || getCurrentServerKey() }),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar o Meu Selo.");
    }
    showToast(payload.message || "Meu Selo atualizado com sucesso.");
    closeAccountSealModal();
    await loadAccountSeals(account || state.account);
}

async function removeAccountSeal(recordId) {
    const response = await fetch(`/api/account-seals/${recordId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || "Erro ao remover o Meu Selo.");
    }
    showToast(payload.message || "My Seal removido com sucesso.");
    await loadAccountSeals(state.account);
}

async function handleAccountRename(event) {
    event.preventDefault();
    if (!elements.renameAccountSelect || !elements.renameAccountInput) {
        return;
    }
    const currentName = elements.renameAccountSelect.value;
    const newName = elements.renameAccountInput.value.trim();
    if (!currentName) {
        showToast("Selecione um perfil de jogo para renomear.", "warning");
        return;
    }
    if (!newName) {
        showToast("Informe o novo nome do perfil de jogo.", "warning");
        return;
    }
    const submitButton =
        event.submitter ||
        (elements.renameAccountForm ? elements.renameAccountForm.querySelector('button[type="submit"]') : null);
    if (submitButton) {
        submitButton.disabled = true;
    }
    try {
        const payload = await apiRenameAccount(currentName, newName);
        migrateStoredCalculatorOpenerPricePreference(currentName, payload.account || newName);
        applyAccountPayload(payload, payload.account || newName);
        showToast(payload.message || "Perfil de jogo renomeado com sucesso.");
        await loadAccountSeals(state.account);
        syncAccountManagerControls();
    } catch (error) {
        showToast(error.message || "Falha ao renomear o perfil de jogo.", "error");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

async function handleAccountDelete(event) {
    event.preventDefault();
    if (!elements.deleteAccountSelect) {
        return;
    }
    const accountToDelete = elements.deleteAccountSelect.value;
    if (!accountToDelete) {
        showToast("Selecione um perfil de jogo para excluir.", "warning");
        return;
    }
    const confirmed = window.confirm(
        `Excluir o perfil de jogo "${accountToDelete}" vai remover os selos, preços e configurações vinculados. Deseja continuar?`
    );
    if (!confirmed) {
        return;
    }
    const submitButton =
        event.submitter ||
        (elements.deleteAccountForm ? elements.deleteAccountForm.querySelector('button[type="submit"]') : null);
    if (submitButton) {
        submitButton.disabled = true;
    }
    try {
        const payload = await apiDeleteAccount(accountToDelete);
        clearStoredCalculatorOpenerPricePreferencesForAccount(accountToDelete);
        applyAccountPayload(payload, payload.account);
        showToast(payload.message || "Perfil de jogo removido com sucesso.");
        if (state.account) {
            await loadAccountSeals(state.account);
        } else {
            state.mySeals = [];
            renderAccountSeals();
            renderTemplates();
            refreshCalculator();
        }
        syncAccountManagerControls();
        if (!state.accounts.length) {
            closeAccountManagerModal();
        }
    } catch (error) {
        showToast(error.message || "Falha ao excluir o perfil de jogo.", "error");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

function collectLevels() {
    const payload = {};
    state.levels.forEach((level) => {
        const thresholdInput = getLevelInput(level, "threshold");
        const percentInput = getLevelInput(level, "percentage");
        const valueInput = getLevelInput(level, "value");
        payload[level] = {
            threshold: parseInteger(thresholdInput ? thresholdInput.value : null),
            percentage: parseNumber(percentInput ? percentInput.value : null),
            value: parseNumber(valueInput ? valueInput.value : null),
        };
    });
    return payload;
}

function parseNumber(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");
    let normalized = raw;
    if (hasComma && !hasDot) {
        normalized = raw.replace(/\./g, "").replace(",", ".");
    } else if (hasDot && !hasComma) {
        normalized = raw.replace(/,/g, "");
    } else if (hasComma && hasDot) {
        // assume dot as thousand separator, comma as decimal
        normalized = raw.replace(/\./g, "").replace(",", ".");
    }
    const cleaned = normalized.replace(/[^0-9eE.+-]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseInteger(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? Math.trunc(value) : null;
    }
    const raw = String(value).trim();
    if (!raw) {
        return null;
    }
    const sign = raw.startsWith("-") ? -1 : 1;
    const numeric = raw.replace(/[^\d.,]/g, "");
    if (!numeric) {
        return null;
    }
    const separators = numeric.match(/[.,]/g) || [];
    if (!separators.length) {
        const parsed = Number.parseInt(numeric, 10);
        return Number.isNaN(parsed) ? null : parsed * sign;
    }
    const lastSeparator = Math.max(numeric.lastIndexOf("."), numeric.lastIndexOf(","));
    const fractionalLength = numeric.length - lastSeparator - 1;
    const treatAsThousands = fractionalLength === 3 || separators.length > 1;
    const normalized = treatAsThousands
        ? numeric.replace(/[.,]/g, "")
        : numeric.slice(0, lastSeparator).replace(/[.,]/g, "") + numeric.slice(lastSeparator);
    const parsed = Number.parseFloat(normalized.replace(",", "."));
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return Math.trunc(parsed * sign);
}

function roundNumber(value, precision) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

function formatThreshold(value) {
    if (value === null || value === undefined || value === "") {
        return "--";
    }
    return thousandFormatter.format(Number(value));
}

function formatAdditionalOpenersText(value) {
    const numeric = Math.max(parseInteger(value) || 0, 0);
    return `${formatThreshold(numeric)} ${numeric === 1 ? "opener novo" : "openers novos"}`;
}

function formatDecimal(value) {
    const numeric = parseNumber(value);
    if (numeric === null) {
        return "--";
    }
    return goldFormatter.format(numeric);
}

function formatPercentage(value) {
    const numeric = parseNumber(value);
    if (numeric === null) {
        return "--";
    }
    return `${percentFormatter.format(numeric)}%`;
}

function formatAttributeValue(attribute, value) {
    const numeric = parseNumber(value);
    if (numeric === null) {
        return "--";
    }
    if (isPercentAttribute(attribute)) {
        return `${percentFormatter.format(numeric)}%`;
    }
    return thousandFormatter.format(numeric);
}

function syncTemplateSelect() {
    if (!elements.accountSealTemplateSelect) {
        return;
    }
    elements.accountSealTemplateSelect.innerHTML = "";
    state.templates.forEach((template) => {
        const option = document.createElement("option");
        option.value = template.id;
        option.textContent = `${template.attribute} - ${template.name}`;
        elements.accountSealTemplateSelect.appendChild(option);
    });
}

function setLoading(isLoading) {
    if (!elements.loader) return;
    elements.loader.classList.toggle("hidden", !isLoading);
}

function showToast(message, type = "info") {
    if (!elements.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
    }, 3800);

    setTimeout(() => {
        toast.remove();
    }, 4200);
}

function openImportSealsModal() {
    if (!elements.importSealsModal) return;
    if (elements.importSealsAttributeSelect) {
        elements.importSealsAttributeSelect.value = state.attributes[0] || "AT";
    }
    if (elements.importSealsServerSelect) {
        elements.importSealsServerSelect.value = getCurrentServerKey();
    }
    if (elements.importSealsFileInput) {
        elements.importSealsFileInput.value = "";
    }
    elements.importSealsModal.classList.remove("hidden");
    elements.importSealsModal.setAttribute("aria-hidden", "false");
}

function closeImportSealsModal() {
    if (!elements.importSealsModal) return;
    elements.importSealsModal.classList.add("hidden");
    elements.importSealsModal.setAttribute("aria-hidden", "true");
}

window.SealsRuntime = {
    clearSealsApiCache,
    elements,
    escapeHtml,
    formatGoldDisplay,
    formatGoldText,
    getCurrentServerKey,
    loadTemplates,
    parseInteger,
    setLoading,
    showToast,
    state,
};

let sealOcrFeaturePromise = null;

function loadDeferredStyle(assetKey) {
    const href = APP_CONFIG.assets?.[assetKey];
    if (!href || document.querySelector(`link[data-deferred-style="${assetKey}"]`)) {
        return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.deferredStyle = assetKey;
    document.head.appendChild(link);
}

function loadDeferredScript(assetKey, globalName) {
    if (globalName && window[globalName]) {
        return Promise.resolve(window[globalName]);
    }
    const src = APP_CONFIG.assets?.[assetKey];
    if (!src) {
        return Promise.reject(new Error("Asset adiado nao configurado."));
    }
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-deferred-script="${assetKey}"]`);
        if (existing) {
            existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
            existing.addEventListener("error", () => reject(new Error("Falha ao carregar recurso adiado.")), { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.defer = true;
        script.dataset.deferredScript = assetKey;
        script.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
        script.addEventListener("error", () => reject(new Error("Falha ao carregar recurso adiado.")), { once: true });
        document.head.appendChild(script);
    });
}

async function loadSealOcrFeature() {
    if (!sealOcrFeaturePromise) {
        loadDeferredStyle("sealOcrCss");
        sealOcrFeaturePromise = loadDeferredScript("sealOcrJs", "SealOcrFeature");
    }
    return sealOcrFeaturePromise;
}

async function openSealOcrModal() {
    try {
        const feature = await loadSealOcrFeature();
        feature.open();
    } catch (error) {
        showToast(error.message || "Nao foi possivel abrir o OCR.", "error");
    }
}

function closeSealOcrModal() {
    if (window.SealOcrFeature) {
        window.SealOcrFeature.close();
        return;
    }
    if (!elements.sealOcrModal) return;
    elements.sealOcrModal.classList.add("hidden");
    elements.sealOcrModal.setAttribute("aria-hidden", "true");
}

window.addEventListener("dmowiki-browser-capture", async (event) => {
    if (!event.detail?.dataUrl) {
        return;
    }
    try {
        const feature = await loadSealOcrFeature();
        feature.loadCaptureDataUrl(event.detail.dataUrl);
    } catch (error) {
        showToast(error.message || "Nao foi possivel carregar a captura.", "error");
    }
});

async function handleImportSealsSubmit(event) {
    event.preventDefault();
    if (!elements.importSealsAttributeSelect || !elements.importSealsServerSelect || !elements.importSealsFileInput) {
        showToast("FormulÃ¡rio incompleto.", "warning");
        return;
    }
    const attribute = elements.importSealsAttributeSelect.value;
    const serverKey = elements.importSealsServerSelect.value;
    const file = elements.importSealsFileInput.files[0];
    if (!attribute || !serverKey) {
        showToast("Selecione atributo e servidor.", "warning");
        return;
    }
    if (!file) {
        showToast("Selecione um arquivo Excel.", "warning");
        return;
    }
    if (!file.name.match(/\.(xlsx?|xls)$/)) {
        showToast("Arquivo deve ser Excel (.xlsx ou .xls).", "warning");
        return;
    }
    const submitButton = elements.importSealsForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        const formData = new FormData();
        formData.append("attribute", attribute);
        formData.append("serverKey", serverKey);
        formData.append("file", file);
        const response = await fetch("/api/seals/import", {
            method: "POST",
            body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao importar selos.");
        }
        clearSealsApiCache();
        showToast(payload.message || "Selos importados com sucesso.");
        closeImportSealsModal();
        await loadTemplates();
    } catch (error) {
        showToast(error.message || "Falha ao importar selos.", "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

init();


