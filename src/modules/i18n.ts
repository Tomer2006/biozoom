export type AppLanguage = 'en' | 'he'

export const LANGUAGE_STORAGE_KEY = 'infinitespecies_language'

type TranslationParams = Record<string, string | number>
type TranslationValue =
  | string
  | ((params: TranslationParams | undefined, language: AppLanguage) => string)
  | Record<string, TranslationValue>

const translations: Record<AppLanguage, Record<string, TranslationValue>> = {
  en: {
    common: {
      close: 'Close',
      cancel: 'Cancel',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      skip: 'Skip',
      settings: 'Settings',
      about: 'About',
      help: 'Controls',
      language: 'Language',
    },
    languageModal: {
      title: 'Choose your language / בחרו שפה',
      englishTitle: 'English',
      englishDescription: 'Use the app in English.',
      hebrewTitle: 'עברית',
      hebrewDescription: 'השתמשו באפליקציה בעברית.',
    },
    onboarding: {
      title: 'Welcome to InfiniteSpecies',
      step: (params) => `Step ${params?.current ?? 1} of ${params?.total ?? 3}`,
      introTitle: 'Explore the tree of life',
      introBody:
        'InfiniteSpecies lets you move from broad groups down to individual organisms in one continuous view.',
      introPoint1: 'Start from the landing page and load the taxonomy map.',
      introPoint2: 'Use the globe icon any time to switch between English and Hebrew.',
      introPoint3: 'Open Help later if you want the full control list.',
      navigateTitle: 'Move around quickly',
      navigateBody: 'The app is designed for fast visual navigation once the map loads.',
      navigatePoint1: 'Left click a group to focus into that branch.',
      navigatePoint2: 'Right click to go back up to the parent.',
      navigatePoint3: 'Use the mouse wheel to zoom and the middle button to pan.',
      toolsTitle: 'Find and share what you see',
      toolsBody: 'The top bar gives you the main tools once you start exploring.',
      toolsPoint1: 'Search by organism or group name from the search box.',
      toolsPoint2: 'Copy a deep link to share the exact place you are viewing.',
      toolsPoint3: 'Use Settings and Help whenever you need them.',
    },
    landing: {
      taglineLine1: 'millions of organisms',
      taglineLine2Prefix: 'one',
      taglineHighlight: 'zoomable map',
      taglineLine2Suffix: '.',
      start: 'Start Exploration',
      startHint: 'Usually takes 10 seconds to load',
    },
    auth: {
      account: 'Account',
      signedIn: 'Signed in',
      signIn: 'Sign in',
      signInShort: 'Sign in',
      manageAccount: 'Manage account',
      signOut: 'Sign out',
      signedInAs: (params) => `Signed in as ${params?.name ?? 'Account'}`,
      notConfigured: 'Clerk auth is not configured yet. Add VITE_CLERK_PUBLISHABLE_KEY first.',
    },
    topbar: {
      returnToMenu: 'Return to main menu',
      searchPlaceholder: 'Search organism or group (use scientific names)',
      searchButton: 'Search',
      copyLink: 'Copy deep link',
      helpButton: 'Help (?)',
      settingsButton: 'Settings',
      noResults: 'No results found',
    },
    breadcrumbs: {
      ariaLabel: 'Taxonomy path',
      navigateTo: (params) => `Navigate to ${params?.name ?? ''}`,
      randomJump: (params) => `Jump to a random organism under ${params?.name ?? ''}`,
      noDeeperBranch: 'No deeper branch available here',
    },
    loading: {
      defaultTitle: 'Loading…',
      loadingTaxonomy: 'Loading taxonomy data…',
      stage: (params) => `Stage ${params?.current ?? 1} of ${params?.total ?? 1}`,
      loadingLabel: 'Loading...',
      hint: 'Tip: Press',
      hintSuffix: 'for help',
    },
    help: {
      title: 'Keyboard Shortcuts & Controls',
      leftClickKey: 'Left Click',
      leftClickDescription: 'Zoom into a group',
      rightClickKey: 'Right Click',
      rightClickDescription: 'Zoom out to parent',
      mouseWheelKey: 'Mouse Wheel',
      mouseWheelDescription: 'Smooth zoom in/out',
      middleDragKey: 'Middle Drag',
      middleDragDescription: 'Pan the view',
      hoverKey: 'Hover',
      hoverDescription: 'Show image preview',
      enterKey: 'Enter',
      enterDescription: 'Search and navigate',
      searchKey: 'W',
      searchDescription: 'Web search current/hovered',
      resetKey: 'R',
      resetDescription: 'Reset to root',
      fitKey: 'F',
      fitDescription: 'Fit current node in view',
      toggleKey: '?',
      toggleDescription: 'Toggle this help panel',
    },
    about: {
      title: 'About InfiniteSpecies',
      appTitle: 'InfiniteSpecies',
      intro1:
        'InfiniteSpecies is an interactive way to explore the Tree of Life. It helps you move through the living world from broad groups to individual organisms in one continuous view.',
      intro2:
        'It is designed for curious exploration, so you can zoom around, follow branches, and get a better sense of how organisms are related to one another.',
      featuresTitle: 'Features',
      feature1:
        'Zoom and pan smoothly through the Tree of Life, from major branches down to individual organisms.',
      feature2: 'Search for organisms by name and jump directly to matching results.',
      feature3: 'Follow the breadcrumb path so you always know where you are in the tree.',
      feature4: 'Hover over organisms to see image previews and quick visual context.',
      feature5: 'Open related reference pages when you want to learn more about a species or group.',
      feature6: 'Copy and share the current view so other people can open the same place in the tree.',
      feature7: 'Adjust visual settings like colors, fonts, and preferred web search provider.',
      feature8: 'Use built-in help and keyboard shortcuts for faster exploration.',
      projectLinks: 'Project links',
      github: 'View on GitHub',
    },
    settings: {
      title: 'Settings',
      languageSection: 'Language',
      languageLabel: 'Interface Language',
      fontSection: 'Font',
      fontLabel: 'Font Family',
      colorSection: 'Color Palette',
      colorLabel: 'Color Scheme',
      searchSection: 'Web Search (W key)',
      searchLabel: 'Search Provider',
    },
    screenshot: {
      title: 'Screenshot Settings',
      resolutionLabel: 'Resolution (pixels per world unit)',
      resolutionHint: 'Higher = more detail but larger file size',
      currentResolution: (params) => `Current: ${params?.value ?? 0} px/unit (recommended: 300-2000)`,
      renderingProgress: (params) =>
        `Rendering screenshot... ${params?.percent ?? 0}% (${params?.completed ?? 0}/${params?.total ?? 0} tiles)`,
      start: 'Start Screenshot',
      capturing: 'Capturing...',
      saved: (params) => `Saved WebP (${params?.width ?? 0}×${params?.height ?? 0})`,
      failed: 'Screenshot failed',
    },
    stage: {
      oneSpecies: '1 species',
      speciesCount: (params) => `${params?.count ?? 0} species`,
      level: (params) => `Level ${params?.level ?? 0}`,
      noImage: 'No image',
      unknown: 'Unknown',
      webSearch: 'Web Search (W)',
      webSearchTitle: 'Search on the web (W)',
    },
    app: {
      copyLinkPrompt: 'Copy link:',
      linkCopied: 'Link copied to clipboard',
    },
    data: {
      loadingBakedFiles: (params) => `Loading ${params?.total ?? 0} baked files...`,
      loadedBakedFiles: (params) => `Loaded ${params?.completed ?? 0}/${params?.total ?? 0} baked files...`,
      rehydratingTree: 'Rehydrating tree structure...',
      loadedNodesWithLayout: (params) => `Loaded ${params?.count ?? 0} nodes with pre-baked layout`,
      creatingNodes: (params) => `Creating nodes... ${params?.current ?? 0}/${params?.total ?? 0}`,
      linkingNodes: (params) => `Linking nodes... ${params?.current ?? 0}/${params?.total ?? 0}`,
      finalizingTree: 'Finalizing tree structure...',
    },
  },
  he: {
    common: {
      close: 'סגירה',
      cancel: 'ביטול',
      back: 'חזרה',
      next: 'הבא',
      done: 'סיום',
      skip: 'דלג',
      settings: 'הגדרות',
      about: 'אודות',
      help: 'עזרה',
      language: 'שפה',
    },
    languageModal: {
      title: 'Choose your language / בחרו שפה',
      englishTitle: 'English',
      englishDescription: 'Use the app in English.',
      hebrewTitle: 'עברית',
      hebrewDescription: 'השתמשו באפליקציה בעברית.',
    },
    onboarding: {
      title: 'ברוכים הבאים ל-InfiniteSpecies',
      step: (params) => `שלב ${params?.current ?? 1} מתוך ${params?.total ?? 3}`,
      introTitle: 'חוקרים את עץ החיים',
      introBody:
        'InfiniteSpecies מאפשרת לנוע מקבוצות רחבות ועד אורגניזמים בודדים בתצוגה רציפה אחת.',
      introPoint1: 'מתחילים ממסך הפתיחה וטוענים את מפת הטקסונומיה.',
      introPoint2: 'אפשר להשתמש באייקון הגלובוס בכל רגע כדי לעבור בין עברית לאנגלית.',
      introPoint3: 'אפשר לפתוח אחר כך את העזרה כדי לראות את כל אמצעי השליטה.',
      navigateTitle: 'זזים במהירות',
      navigateBody: 'אחרי שהמפה נטענת, הניווט מיועד להיות מהיר וחזותי.',
      navigatePoint1: 'קליק שמאלי על קבוצה כדי להתמקד בענף שלה.',
      navigatePoint2: 'קליק ימני כדי לחזור להורה.',
      navigatePoint3: 'משתמשים בגלגלת לזום ובכפתור האמצעי להזזה.',
      toolsTitle: 'מוצאים ומשתפים',
      toolsBody: 'הסרגל העליון נותן את הכלים המרכזיים אחרי שמתחילים לחקור.',
      toolsPoint1: 'מחפשים אורגניזם או קבוצה דרך שורת החיפוש.',
      toolsPoint2: 'מעתיקים קישור ישיר כדי לשתף את המיקום המדויק בעץ.',
      toolsPoint3: 'משתמשים בהגדרות ובעזרה בכל פעם שצריך.',
    },
    landing: {
      taglineLine1: 'מיליוני אורגניזמים',
      taglineLine2Prefix: 'מפה',
      taglineHighlight: 'אינטראקטיבית',
      taglineLine2Suffix: 'אחת.',
      start: 'התחילו לחקור',
      startHint: 'בדרך כלל הטעינה אורכת כ-10 שניות',
    },
    topbar: {
      returnToMenu: 'חזרה לתפריט הראשי',
      searchPlaceholder: 'חפשו אורגניזם או קבוצה (מומלץ שם מדעי)',
      searchButton: 'חיפוש',
      copyLink: 'העתקת קישור ישיר',
      helpButton: 'עזרה (?)',
      settingsButton: 'הגדרות',
      noResults: 'לא נמצאו תוצאות',
    },
    breadcrumbs: {
      ariaLabel: 'מסלול טקסונומי',
      navigateTo: (params) => `מעבר אל ${params?.name ?? ''}`,
      randomJump: (params) => `קפיצה לאורגניזם אקראי תחת ${params?.name ?? ''}`,
      noDeeperBranch: 'אין כאן ענף עמוק יותר',
    },
    loading: {
      defaultTitle: 'טוען…',
      loadingTaxonomy: 'טוען את נתוני הטקסונומיה…',
      stage: (params) => `שלב ${params?.current ?? 1} מתוך ${params?.total ?? 1}`,
      loadingLabel: 'טוען...',
      hint: 'טיפ: לחצו על',
      hintSuffix: 'לעזרה',
    },
    help: {
      title: 'קיצורי מקלדת ואמצעי שליטה',
      leftClickKey: 'קליק שמאלי',
      leftClickDescription: 'התקרבות לקבוצה',
      rightClickKey: 'קליק ימני',
      rightClickDescription: 'חזרה להורה',
      mouseWheelKey: 'גלגלת',
      mouseWheelDescription: 'זום חלק פנימה והחוצה',
      middleDragKey: 'גרירה אמצעית',
      middleDragDescription: 'הזזת התצוגה',
      hoverKey: 'ריחוף',
      hoverDescription: 'הצגת תצוגת תמונה',
      enterKey: 'Enter',
      enterDescription: 'חיפוש וניווט',
      searchKey: 'W',
      searchDescription: 'חיפוש ברשת עבור הנוכחי או המרוחף',
      resetKey: 'R',
      resetDescription: 'חזרה לשורש',
      fitKey: 'F',
      fitDescription: 'התאמת הצומת הנוכחי למסך',
      toggleKey: '?',
      toggleDescription: 'פתיחה או סגירה של חלון העזרה',
    },
    about: {
      title: 'אודות InfiniteSpecies',
      appTitle: 'InfiniteSpecies',
      intro1:
        'InfiniteSpecies היא דרך אינטראקטיבית לחקור את עץ החיים. היא מאפשרת לנוע בעולם החי מקבוצות רחבות ועד אורגניזמים בודדים בתצוגה רציפה אחת.',
      intro2:
        'המערכת מיועדת לחקירה סקרנית, כך שאפשר להתקרב, לעקוב אחרי ענפים, ולקבל תחושה טובה יותר של הקשרים בין אורגניזמים שונים.',
      featuresTitle: 'יכולות',
      feature1: 'זום ותזוזה חלקים דרך עץ החיים, מהענפים הגדולים ועד אורגניזמים בודדים.',
      feature2: 'חיפוש אורגניזמים לפי שם וקפיצה ישירה לתוצאות מתאימות.',
      feature3: 'מעקב אחרי מסלול הפירורים כדי שתמיד תדעו איפה אתם נמצאים בעץ.',
      feature4: 'ריחוף מעל אורגניזמים כדי לראות תצוגות תמונה והקשר חזותי מהיר.',
      feature5: 'פתיחת דפי עיון קשורים כשאתם רוצים ללמוד עוד על מין או קבוצה.',
      feature6: 'העתקה ושיתוף של התצוגה הנוכחית כך שאנשים אחרים יפתחו בדיוק את אותו מקום בעץ.',
      feature7: 'התאמת ההגדרות החזותיות כמו צבעים, פונטים וספק חיפוש מועדף ברשת.',
      feature8: 'שימוש בעזרה המובנית ובקיצורי המקלדת לחקירה מהירה יותר.',
      projectLinks: 'קישורי הפרויקט',
      github: 'צפייה ב-GitHub',
    },
    settings: {
      title: 'הגדרות',
      languageSection: 'שפה',
      languageLabel: 'שפת הממשק',
      fontSection: 'פונט',
      fontLabel: 'משפחת פונטים',
      colorSection: 'פלטת צבעים',
      colorLabel: 'ערכת צבעים',
      searchSection: 'חיפוש ברשת (מקש S)',
      searchLabel: 'ספק חיפוש',
    },
    screenshot: {
      title: 'הגדרות צילום מסך',
      resolutionLabel: 'רזולוציה (פיקסלים ליחידת עולם)',
      resolutionHint: 'גבוה יותר = יותר פרטים אבל קובץ גדול יותר',
      currentResolution: (params) => `נוכחי: ${params?.value ?? 0} פיקסלים ליחידה (מומלץ: 300-2000)`,
      renderingProgress: (params) =>
        `מצייר צילום מסך... ${params?.percent ?? 0}% (${params?.completed ?? 0}/${params?.total ?? 0} אריחים)`,
      start: 'התחלת צילום מסך',
      capturing: 'מצלם...',
      saved: (params) => `קובץ WebP נשמר (${params?.width ?? 0}×${params?.height ?? 0})`,
      failed: 'צילום המסך נכשל',
    },
    stage: {
      oneSpecies: 'מין אחד',
      speciesCount: (params) => `${params?.count ?? 0} מינים`,
      level: (params) => `רמה ${params?.level ?? 0}`,
      noImage: 'אין תמונה',
      unknown: 'לא ידוע',
      webSearch: 'חיפוש ברשת (W)',
      webSearchTitle: 'חיפוש ברשת (W)',
    },
    app: {
      copyLinkPrompt: 'העתקת קישור:',
      linkCopied: 'הקישור הועתק ללוח',
    },
    data: {
      loadingBakedFiles: (params) => `טוען ${params?.total ?? 0} קבצי baked...`,
      loadedBakedFiles: (params) => `נטענו ${params?.completed ?? 0}/${params?.total ?? 0} קבצי baked...`,
      rehydratingTree: 'בונה מחדש את מבנה העץ...',
      loadedNodesWithLayout: (params) => `נטענו ${params?.count ?? 0} צמתים עם פריסה מוכנה מראש`,
      creatingNodes: (params) => `יוצר צמתים... ${params?.current ?? 0}/${params?.total ?? 0}`,
      linkingNodes: (params) => `מקשר צמתים... ${params?.current ?? 0}/${params?.total ?? 0}`,
      finalizingTree: 'משלים את מבנה העץ...',
    },
  },
}

const languageLabels: Record<AppLanguage, string> = {
  en: 'English',
  he: 'עברית',
}

const colorPresetLabels: Record<string, Record<AppLanguage, string>> = {
  blueGradient: { en: 'Blue Gradient', he: 'מעבר כחול' },
  tableau10: { en: 'Tableau 10', he: 'Tableau 10' },
}

let currentLanguage: AppLanguage = 'en'

function isObject(value: TranslationValue | undefined): value is Record<string, TranslationValue> {
  return typeof value === 'object' && value !== null
}

function resolveTranslation(language: AppLanguage, key: string): TranslationValue | undefined {
  const parts = key.split('.')
  let current: TranslationValue | undefined = translations[language]

  for (const part of parts) {
    if (!isObject(current) || !(part in current)) {
      return undefined
    }
    current = current[part]
  }

  return current
}

export function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'en' || value === 'he'
}

export function isRtlLanguage(language: AppLanguage): boolean {
  void language
  return false
}

export function getStoredLanguage(): AppLanguage | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isSupportedLanguage(value) ? value : null
}

export function hasStoredLanguage(): boolean {
  return getStoredLanguage() !== null
}

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage
}

export function getLanguageDirection(language: AppLanguage): 'ltr' | 'rtl' {
  void language
  return 'ltr'
}

export function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document === 'undefined') return
  const direction = getLanguageDirection(language)
  document.documentElement.lang = language
  document.documentElement.dir = direction
  document.body?.setAttribute('dir', direction)
}

export function initializeLanguage() {
  currentLanguage = getStoredLanguage() ?? 'en'
  applyDocumentLanguage(currentLanguage)
}

export function setCurrentLanguage(language: AppLanguage) {
  currentLanguage = language
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }
  applyDocumentLanguage(language)
}

export function translate(key: string, params?: TranslationParams, language: AppLanguage = currentLanguage): string {
  const value = resolveTranslation(language, key) ?? resolveTranslation('en', key)

  if (typeof value === 'function') {
    return value(params, language)
  }

  if (typeof value === 'string') {
    return value
  }

  return key
}

export function formatNumber(value: number, language: AppLanguage = currentLanguage): string {
  return new Intl.NumberFormat(language).format(value)
}

export function getLanguageLabel(language: AppLanguage): string {
  return languageLabels[language]
}

export function getColorPresetLabel(preset: string, language: AppLanguage = currentLanguage): string {
  const label = colorPresetLabels[preset]
  if (label) {
    return label[language]
  }

  return preset
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()
}

