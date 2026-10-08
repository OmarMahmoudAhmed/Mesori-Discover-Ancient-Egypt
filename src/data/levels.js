/*
 * =====================================================
 * levels.js - بيانات المستويات والمراحل (Mock Data)
 * =====================================================
 *
 * هيكل البيانات:
 * ┌─── 5 مستويات (Levels)
 * │     ├── بيانات المستوى (لون، اسم، صعوبة...)
 * │     └── 5 مراحل (Stages) لكل مستوى
 * │           ├── عنوان المرحلة
 * │           ├── وصفها
 * │           └── حالتها (مفتوح/مقفول/مكتمل)
 *
 * عند الترحيل لـ Supabase، هذه البيانات ستُخزن في:
 * ┌─────────────────────────────────────────────────┐
 * │  جدول "levels":                                 │
 * │   id, name_ar, name_en, difficulty, color...    │
 * │                                                 │
 * │  جدول "stages":                                 │
 * │   id, level_id, title, description, order...    │
 * │                                                 │
 * │  جدول "user_progress":                          │
 * │   user_id, stage_id, is_completed, points...    │
 * └─────────────────────────────────────────────────┘
 * =====================================================
 */

export const levelsData = [

  /* =================================================
   * المستوى 1 - سهل (Easy)
   * اللون الأساسي: أخضر داكن
   * الهوية: بداية الرحلة، ترحيبي وسهل
   * ================================================= */
  {
    id:          1,           /* معرّف المستوى الفريد */
    nameEn:      'Level 1',  /* الاسم بالإنجليزية - يظهر في رأس البطاقة */
    nameAr:      'سهل',      /* اسم الصعوبة بالعربية */
    iconSrc:     '/assets/icons/levels/level-1-pyramid.png', /* أيقونة الهرم — سيتم إضافتها لاحقاً */
    description: 'مثالي للمبتدئين في عالم مصر القديمة',

    /* ألوان البطاقة الكاملة */
    bgColor:     '#1B5E2E',  /* خلفية البطاقة الرئيسية */
    headerBg:    '#143F20',  /* خلفية رأس البطاقة (أغمق) */
    textColor:   '#4ADE80',  /* لون نص اسم الصعوبة العربي */
    iconBg:      '#0F2D18',  /* خلفية دائرة الأيقونة */
    badgeBg:     '#0F2D18',  /* خلفية شارات الإحصائيات */
    badgeText:   '#86EFAC',  /* لون نص الإحصائيات */

    /* إحصائيات المستوى */
    quizCount:   10,  /* عدد الأسئلة في كل مرحلة */
    maxPoints:   100, /* أقصى نقاط ممكنة في المستوى */
    totalStages: 5,   /* إجمالي عدد المراحل */

    /* حالة المستوى */
    isUnlocked:  true,  /* المستوى الأول دائماً مفتوح */
    earnedPoints: 0,    /* النقاط التي كسبها المستخدم هنا */

    /* مراحل المستوى الأول (5 مراحل) */
    stages: [
      {
        id:           1,
        levelId:      1,                          /* ربط بالمستوى الأم */
        title:        'البدايات',
        description:  'تعرف على مصر القديمة وأهم رموزها.',
        emoji:        '🏜️',
        isUnlocked:   true,                       /* المرحلة الأولى دائماً مفتوحة */
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: null,                    /* لا يوجد شرط للفتح */
      },
      {
        id:           2,
        levelId:      1,
        title:        'الحضارة',
        description:  'اختبر معلوماتك عن الحياة والثقافة في مصر القديمة.',
        emoji:        '🏛️',
        isUnlocked:   false,                      /* مقفولة حتى تكمل المرحلة 1 */
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 1 لفتح هذه المرحلة',
      },
      {
        id:           3,
        levelId:      1,
        title:        'المعابد',
        description:  'اكتشف أسرار المعابد والآلهة المصرية.',
        emoji:        '🌿',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 2 لفتح هذه المرحلة',
      },
      {
        id:           4,
        levelId:      1,
        title:        'الفراعنة',
        description:  'تعرف على أشهر الفراعنة وإنجازاتهم العظيمة.',
        emoji:        '👑',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 3 لفتح هذه المرحلة',
      },
      {
        id:           5,
        levelId:      1,
        title:        'النيل والحياة',
        description:  'دور نهر النيل في قيام الحضارة المصرية.',
        emoji:        '🌊',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 4 لفتح هذه المرحلة',
      },
    ],
  },


  /* =================================================
   * المستوى 2 - متوسط (Medium)
   * اللون الأساسي: فيروزي زمردي
   * ================================================= */
  {
    id:          2,
    nameEn:      'Level 2',
    nameAr:      'متوسط',
    iconSrc:     '/assets/icons/levels/level-2-pharaoh-mask.png', /* أيقونة قناع الفرعون الذهبي — سيتم إضافتها لاحقاً */
    description: 'تحدٍّ أكبر ومعرفة أعمق بالحضارة',
    bgColor:     '#0D7E72',
    headerBg:    '#085E54',
    textColor:   '#34D399',
    iconBg:      '#054540',
    badgeBg:     '#054540',
    badgeText:   '#6EE7B7',
    quizCount:   10,
    maxPoints:   100,
    totalStages: 5,
    isUnlocked:  false,  /* يُفتح بعد إكمال المستوى 1 */
    earnedPoints: 0,
    stages: [
      {
        id:           1,
        levelId:      2,
        title:        'الحياة اليومية',
        description:  'استكشف كيف كان يعيش المصريون القدماء يومهم.',
        emoji:        '🏺',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المستوى الأول لفتح هذا المستوى',
      },
      {
        id:           2,
        levelId:      2,
        title:        'الكتابة والعلوم',
        description:  'تعرف على أسرار الكتابة الهيروغليفية وعلوم المصريين.',
        emoji:        '📜',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 1 لفتح هذه المرحلة',
      },
      {
        id:           3,
        levelId:      2,
        title:        'الفن والعمارة',
        description:  'اكتشف روائع الفن المصري القديم وأسرار العمارة.',
        emoji:        '🗿',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 2 لفتح هذه المرحلة',
      },
      {
        id:           4,
        levelId:      2,
        title:        'الأساطير والآلهة',
        description:  'تعمّق في عالم الآلهة والأساطير المصرية القديمة.',
        emoji:        '🦅',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 3 لفتح هذه المرحلة',
      },
      {
        id:           5,
        levelId:      2,
        title:        'التجارة والاقتصاد',
        description:  'تعرف على كيف تاجر المصريون القدماء مع العالم.',
        emoji:        '⛵',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 4 لفتح هذه المرحلة',
      },
    ],
  },


  /* =================================================
   * المستوى 3 - صعب (Hard)
   * اللون الأساسي: أزرق نيلي داكن
   * ================================================= */
  {
    id:          3,
    nameEn:      'Level 3',
    nameAr:      'صعب',
    iconSrc:     '/assets/icons/levels/level-3-pillar.png', /* أيقونة العمود الفرعوني — سيتم إضافتها لاحقاً */
    description: 'اختبر نفسك بأسئلة متقدمة عن الحضارة',
    bgColor:     '#1A3A6B',
    headerBg:    '#122848',
    textColor:   '#60A5FA',
    iconBg:      '#0D1E3D',
    badgeBg:     '#0D1E3D',
    badgeText:   '#93C5FD',
    quizCount:   10,
    maxPoints:   100,
    totalStages: 5,
    isUnlocked:  false,
    earnedPoints: 0,
    stages: [
      {
        id:           1,
        levelId:      3,
        title:        'الدولة القديمة',
        description:  'عصر بناء الأهرامات العظيمة وأول ملوك مصر الكبار.',
        emoji:        '🔺',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المستوى الثاني لفتح هذا المستوى',
      },
      {
        id:           2,
        levelId:      3,
        title:        'الدولة الوسطى',
        description:  'عصر إعادة التوحيد وازدهار الأدب المصري القديم.',
        emoji:        '🌾',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 1 لفتح هذه المرحلة',
      },
      {
        id:           3,
        levelId:      3,
        title:        'الدولة الحديثة',
        description:  'عصر الإمبراطورية المصرية العظمى وأعظم الفراعنة.',
        emoji:        '🐎',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 2 لفتح هذه المرحلة',
      },
      {
        id:           4,
        levelId:      3,
        title:        'الجيش والحروب',
        description:  'تعرف على أسلحة وتكتيكات الجيش المصري القديم.',
        emoji:        '⚔️',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 3 لفتح هذه المرحلة',
      },
      {
        id:           5,
        levelId:      3,
        title:        'العلاقات الخارجية',
        description:  'اكتشف علاقات مصر القديمة بالحضارات المجاورة.',
        emoji:        '🗺️',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 4 لفتح هذه المرحلة',
      },
    ],
  },


  /* =================================================
   * المستوى 4 - صعب جداً (Very Hard)
   * اللون الأساسي: بني شوكولاتة
   * ================================================= */
  {
    id:          4,
    nameEn:      'Level 4',
    nameAr:      'صعب جداً',
    iconSrc:     '/assets/icons/levels/level-4-pharaoh-figure.png', /* أيقونة تمثال الفرعون — سيتم إضافتها لاحقاً */
    description: 'للمتحدين فقط - أسئلة صعبة جداً!',
    bgColor:     '#3B1A08',
    headerBg:    '#2A1206',
    textColor:   '#FB923C',
    iconBg:      '#1E0D04',
    badgeBg:     '#1E0D04',
    badgeText:   '#FDBA74',
    quizCount:   10,
    maxPoints:   100,
    totalStages: 5,
    isUnlocked:  false,
    earnedPoints: 0,
    stages: [
      {
        id:           1,
        levelId:      4,
        title:        'الملكات العظيمات',
        description:  'تعرف على أشهر ملكات مصر القديمة وإنجازاتهن.',
        emoji:        '👸',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المستوى الثالث لفتح هذا المستوى',
      },
      {
        id:           2,
        levelId:      4,
        title:        'اخناتون والثورة الدينية',
        description:  'اكتشف قصة أغرب ثورة دينية في تاريخ مصر القديمة.',
        emoji:        '☀️',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 1 لفتح هذه المرحلة',
      },
      {
        id:           3,
        levelId:      4,
        title:        'علم الآثار المصري',
        description:  'تعرف على قصص اكتشاف كنوز مصر القديمة.',
        emoji:        '🔍',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 2 لفتح هذه المرحلة',
      },
      {
        id:           4,
        levelId:      4,
        title:        'الأدب والحكمة',
        description:  'استكشف روائع الأدب والحكمة عند قدماء المصريين.',
        emoji:        '📚',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 3 لفتح هذه المرحلة',
      },
      {
        id:           5,
        levelId:      4,
        title:        'الحياة بعد الموت',
        description:  'تعمّق في معتقدات المصريين القدماء عن الآخرة.',
        emoji:        '⚖️',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 4 لفتح هذه المرحلة',
      },
    ],
  },


  /* =================================================
   * المستوى 5 - متقدم (Expert)
   * اللون الأساسي: ذهبي داكن
   * ================================================= */
  {
    id:          5,
    nameEn:      'Level 5',
    nameAr:      'متقدم',
    iconSrc:     '/assets/icons/levels/level-5-ankh-shield.png', /* أيقونة الدرع والعنخ — سيتم إضافتها لاحقاً */
    description: 'المستوى النهائي - مكان الخبراء الحقيقيين!',
    bgColor:     '#7A5200',
    headerBg:    '#5A3C00',
    textColor:   '#FBBF24',
    iconBg:      '#3D2800',
    badgeBg:     '#3D2800',
    badgeText:   '#FCD34D',
    quizCount:   10,
    maxPoints:   100,
    totalStages: 5,
    isUnlocked:  false,
    earnedPoints: 0,
    stages: [
      {
        id:           1,
        levelId:      5,
        title:        'التقويم والزمن',
        description:  'اكتشف كيف قاس المصريون القدماء الزمن والتقويم.',
        emoji:        '⏳',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المستوى الرابع لفتح هذا المستوى',
      },
      {
        id:           2,
        levelId:      5,
        title:        'المرأة والمجتمع',
        description:  'تعرف على مكانة المرأة في المجتمع المصري القديم.',
        emoji:        '👩',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 1 لفتح هذه المرحلة',
      },
      {
        id:           3,
        levelId:      5,
        title:        'اللغة الهيروغليفية المتقدمة',
        description:  'تعمّق أكثر في أسرار الكتابة المصرية القديمة.',
        emoji:        '🗝️',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 2 لفتح هذه المرحلة',
      },
      {
        id:           4,
        levelId:      5,
        title:        'مصر والعالم القديم',
        description:  'اكتشف علاقة مصر القديمة بالحضارات العالمية الكبرى.',
        emoji:        '🌍',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 3 لفتح هذه المرحلة',
      },
      {
        id:           5,
        levelId:      5,
        title:        'إرث مصر القديمة',
        description:  'تعرف على إرث مصر القديمة وتأثيرها حتى اليوم.',
        emoji:        '🌟',
        isUnlocked:   false,
        isCompleted:  false,
        earnedPoints: 0,
        unlockCondition: 'أكمل المرحلة 4 لفتح هذه المرحلة',
      },
    ],
  },

];
