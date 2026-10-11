import 'package:cloud_firestore/cloud_firestore.dart';

/// A rice variety with its crop duration.
///
/// Durations are typical values from Rice Department variety descriptions;
/// photoperiod-sensitive varieties (ไวต่อช่วงแสง) are timed by season
/// (they flower in late October) rather than by a fixed day count. Users
/// can override the duration per field.
class RiceVariety {
  const RiceVariety({
    required this.id,
    required this.name,
    required this.type,
    this.maturityDays,
    this.photoSensitive = false,
    this.harvestMonth = 11,
    this.harvestDay = 25,
  });

  final String id;
  final String name;

  /// ข้าวเจ้า / ข้าวเหนียว / ข้าวหอม
  final String type;

  /// Days from sowing to harvest (non-sensitive varieties).
  final int? maturityDays;
  final bool photoSensitive;

  /// Typical harvest date for photoperiod-sensitive varieties.
  final int harvestMonth;
  final int harvestDay;

  bool get isCustom => id == custom;
  static const custom = 'custom';

  String get durationLabel {
    if (isCustom) return 'กำหนดอายุเอง';
    if (photoSensitive) return 'ไวต่อช่วงแสง · เก็บเกี่ยวราว $harvestDay พ.ย.';
    return 'อายุประมาณ $maturityDays วัน';
  }
}

class RiceVarieties {
  RiceVarieties._();

  static const all = <RiceVariety>[
    RiceVariety(id: 'kdml105', name: 'ขาวดอกมะลิ 105', type: 'ข้าวหอม', photoSensitive: true, harvestDay: 25),
    RiceVariety(id: 'rd15', name: 'กข15', type: 'ข้าวหอม', photoSensitive: true, harvestDay: 15),
    RiceVariety(id: 'rd6', name: 'กข6', type: 'ข้าวเหนียว', photoSensitive: true, harvestDay: 25),
    RiceVariety(id: 'pathum1', name: 'ปทุมธานี 1', type: 'ข้าวหอม', maturityDays: 115),
    RiceVariety(id: 'rd41', name: 'กข41', type: 'ข้าวเจ้า', maturityDays: 104),
    RiceVariety(id: 'rd47', name: 'กข47', type: 'ข้าวเจ้า', maturityDays: 104),
    RiceVariety(id: 'rd49', name: 'กข49', type: 'ข้าวเจ้า', maturityDays: 103),
    RiceVariety(id: 'rd61', name: 'กข61', type: 'ข้าวเจ้า', maturityDays: 100),
    RiceVariety(id: 'rd43', name: 'กข43', type: 'ข้าวเจ้า', maturityDays: 95),
    RiceVariety(id: 'suphan1', name: 'สุพรรณบุรี 1', type: 'ข้าวเจ้า', maturityDays: 120),
    RiceVariety(id: RiceVariety.custom, name: 'พันธุ์อื่น ๆ', type: 'กำหนดเอง'),
  ];

  static RiceVariety byId(String id) => all.firstWhere((v) => v.id == id, orElse: () => all.last);
}

enum PlantingMethod {
  broadcast('หว่าน', 'หว่านน้ำตม/หว่านแห้ง'),
  transplant('ปักดำ', 'ตกกล้าแล้วปักดำ'),
  drill('หยอด', 'หยอดเมล็ดเป็นแถว');

  const PlantingMethod(this.label, this.description);
  final String label;
  final String description;

  static PlantingMethod parse(String? s) =>
      PlantingMethod.values.firstWhere((m) => m.name == s, orElse: () => PlantingMethod.broadcast);
}

class RiceField {
  RiceField({
    this.id = '',
    required this.userId,
    required this.name,
    required this.varietyId,
    this.varietyName,
    required this.method,
    required this.sownAt,
    required this.areaRai,
    this.lat,
    this.lng,
    this.address,
    this.maturityOverride,
    this.status = 'active',
    this.harvestedAt,
    this.yieldKg,
    this.taskLog = const {},
    this.createdAt,
    this.colorIndex = 0,
    this.note = '',
  });

  final String id;
  final String userId;
  final String name;
  final String varietyId;

  /// Free-text name when [varietyId] is custom.
  final String? varietyName;
  final PlantingMethod method;

  /// Sowing date (วันหว่าน หรือวันตกกล้าสำหรับนาดำ) — day 0 of the crop.
  final DateTime sownAt;
  final double areaRai;
  final double? lat;
  final double? lng;
  final String? address;
  final int? maturityOverride;
  final String status;
  final DateTime? harvestedAt;
  final double? yieldKg;

  /// Task id → when it was ticked off.
  final Map<String, DateTime> taskLog;
  final DateTime? createdAt;

  /// Index into [fieldColors]; tells fields apart at a glance.
  final int colorIndex;

  /// Landmark or remark, e.g. "ติดคลองหลังวัด".
  final String note;

  int get color => fieldColors[colorIndex % fieldColors.length];

  /// First letter/digit of the name for the field avatar (skips Thai vowels/marks).
  String get initial {
    final m = RegExp(r'[ก-ฮA-Za-z0-9]').firstMatch(name);
    return m == null ? '•' : m.group(0)!.toUpperCase();
  }

  bool get isHarvested => status == 'harvested';
  bool get hasLocation => lat != null && lng != null;
  RiceVariety get variety => RiceVarieties.byId(varietyId);
  String get varietyLabel =>
      variety.isCustom ? (varietyName?.trim().isNotEmpty == true ? varietyName! : 'พันธุ์อื่น ๆ') : variety.name;
  double? get yieldPerRai => yieldKg != null && areaRai > 0 ? yieldKg! / areaRai : null;

  GrowthPlan get plan => GrowthPlan.of(this);

  static DateTime? _date(dynamic v) => v is Timestamp ? v.toDate() : (v is DateTime ? v : null);

  factory RiceField.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    final log = <String, DateTime>{};
    (d['task_log'] as Map<String, dynamic>? ?? {}).forEach((k, v) {
      final t = _date(v);
      if (t != null) log[k] = t;
    });
    return RiceField(
      id: doc.id,
      userId: d['user_id'] as String? ?? '',
      name: d['name'] as String? ?? 'แปลงนา',
      varietyId: d['variety_id'] as String? ?? RiceVariety.custom,
      varietyName: d['variety_name'] as String?,
      method: PlantingMethod.parse(d['method'] as String?),
      sownAt: _date(d['sown_at']) ?? DateTime.now(),
      areaRai: (d['area_rai'] as num?)?.toDouble() ?? 0,
      lat: (d['lat'] as num?)?.toDouble(),
      lng: (d['lng'] as num?)?.toDouble(),
      address: d['address'] as String?,
      maturityOverride: (d['maturity_days'] as num?)?.toInt(),
      status: d['status'] as String? ?? 'active',
      harvestedAt: _date(d['harvested_at']),
      yieldKg: (d['yield_kg'] as num?)?.toDouble(),
      taskLog: log,
      createdAt: _date(d['created_at']),
      colorIndex: (d['color'] as num?)?.toInt() ?? 0,
      note: d['note'] as String? ?? '',
    );
  }

  /// Editable fields only; owner, status and timestamps are managed by the service.
  Map<String, dynamic> toFormData() => {
        'name': name.trim(),
        'variety_id': varietyId,
        'variety_name': variety.isCustom ? varietyName?.trim() : null,
        'method': method.name,
        'sown_at': Timestamp.fromDate(DateTime(sownAt.year, sownAt.month, sownAt.day)),
        'area_rai': areaRai,
        'lat': lat,
        'lng': lng,
        'address': address,
        'maturity_days': maturityOverride,
        'color': colorIndex,
        'note': note.trim(),
      };
}

/// Distinct field tag colours (ARGB), readable on cream and white.
const fieldColors = <int>[
  0xFF2D6A4F,
  0xFF1E5A8A,
  0xFFB45309,
  0xFF7C3AED,
  0xFFB42318,
  0xFF0F766E,
  0xFF8A5A2B,
  0xFFBE185D,
];

/// A growth stage covering days [start, end) after sowing.
class GrowthStage {
  const GrowthStage(this.key, this.name, this.start, this.end);
  final String key;
  final String name;
  final int start;
  final int end;
  int get length => end - start;
}

/// A recommended field job on a given crop day.
class FieldTask {
  const FieldTask({
    required this.id,
    required this.title,
    required this.detail,
    required this.day,
    this.window = 5,
    this.kind = 'care',
  });

  final String id;
  final String title;
  final String detail;

  /// Crop day the job is due.
  final int day;

  /// Days after [day] before it counts as overdue.
  final int window;

  /// fertilizer | weed | water | survey | harvest | care
  final String kind;
}

enum TaskState { done, overdue, now, upcoming }

/// Crop calendar derived from variety, sowing date and planting method.
///
/// Timeline (days from sowing, H = harvest):
///   flowering F = H − 30 (grain fill to harvest maturity ≈ 30 days)
///   panicle initiation PI = F − 30 (reproductive phase ≈ 30 days)
///   seedling ends at 20 days (25 for transplanted nursery seedlings)
class GrowthPlan {
  GrowthPlan._(this.field, this.harvestDay, this.lateSowing);

  final RiceField field;
  final int harvestDay;

  /// A photoperiod-sensitive variety sown so late it has under 90 days.
  final bool lateSowing;

  factory GrowthPlan.of(RiceField f) {
    final v = f.variety;
    var late = false;
    int h;
    if (f.maturityOverride != null && f.maturityOverride! > 0) {
      h = f.maturityOverride!;
    } else if (v.photoSensitive) {
      final harvest = DateTime(f.sownAt.year, v.harvestMonth, v.harvestDay);
      h = harvest.difference(_d(f.sownAt)).inDays;
      if (h < 90) {
        late = true;
        h = 90;
      }
    } else {
      h = v.maturityDays ?? 110;
    }
    return GrowthPlan._(f, h.clamp(60, 240), late);
  }

  static DateTime _d(DateTime t) => DateTime(t.year, t.month, t.day);

  int get floweringDay => harvestDay - 30;
  int get panicleDay => floweringDay - 30;
  int get seedlingEnd {
    final base = field.method == PlantingMethod.transplant ? 25 : 20;
    return base.clamp(10, panicleDay - 10);
  }

  DateTime dateOf(int day) => _d(field.sownAt).add(Duration(days: day));
  DateTime get harvestDate => dateOf(harvestDay);

  int dayOn(DateTime now) => _d(now).difference(_d(field.sownAt)).inDays;
  int get today => dayOn(DateTime.now());
  int get daysToHarvest => harvestDay - today;
  double get progress => (today / harvestDay).clamp(0.0, 1.0);

  List<GrowthStage> get stages => [
        GrowthStage('seedling', 'ระยะกล้า', 0, seedlingEnd),
        GrowthStage('tillering', 'ระยะแตกกอ', seedlingEnd, panicleDay),
        GrowthStage('booting', 'ระยะตั้งท้อง', panicleDay, floweringDay - 3),
        GrowthStage('heading', 'ระยะออกรวง', floweringDay - 3, floweringDay + 7),
        GrowthStage('ripening', 'ระยะข้าวสุกแก่', floweringDay + 7, harvestDay),
      ];

  GrowthStage stageOn(int day) {
    if (day < 0) return const GrowthStage('planned', 'ยังไม่ถึงวันปลูก', -1, 0);
    if (day >= harvestDay) return GrowthStage('harvest', 'พร้อมเก็บเกี่ยว', harvestDay, harvestDay + 30);
    return stages.lastWhere((s) => day >= s.start, orElse: () => stages.first);
  }

  GrowthStage get stage => stageOn(today);

  List<FieldTask> get tasks {
    final m = field.method;
    final fert1 = switch (m) { PlantingMethod.transplant => 35, _ => 20 };
    return [
      FieldTask(
        id: 'weed',
        kind: 'weed',
        title: 'สำรวจและกำจัดวัชพืช',
        detail: m == PlantingMethod.transplant
            ? 'หลังปักดำรักษาระดับน้ำ 5–10 ซม. เพื่อคุมวัชพืช ถอนวัชพืชที่หลงเหลือ'
            : 'ช่วงต้นกล้ายังเล็ก วัชพืชแย่งอาหารได้มาก ควรกำจัดก่อนข้าวแตกกอ',
        day: m == PlantingMethod.transplant ? 32 : 15,
        window: 7,
      ),
      FieldTask(
        id: 'fert1',
        kind: 'fertilizer',
        title: 'ใส่ปุ๋ยครั้งที่ 1 (ช่วงแตกกอ)',
        detail:
            'ใช้สูตรตามชนิดดิน เช่น ดินเหนียว 16-20-0 หรือดินร่วนปนทราย 16-16-8 ประมาณ 20–30 กก./ไร่ ปรับตามค่าวิเคราะห์ดิน',
        day: fert1,
        window: 7,
      ),
      FieldTask(
        id: 'survey1',
        kind: 'survey',
        title: 'สำรวจโรคไหม้และเพลี้ยกระโดดสีน้ำตาล',
        detail: 'เดินสำรวจทั่วแปลง หากพบใบผิดปกติให้สแกนด้วย Rice AI เพื่อตรวจโรค',
        day: ((seedlingEnd + panicleDay) / 2).round(),
        window: 7,
      ),
      FieldTask(
        id: 'fert2',
        kind: 'fertilizer',
        title: 'ใส่ปุ๋ยครั้งที่ 2 (ระยะกำเนิดช่อดอก)',
        detail: 'ใส่ปุ๋ยยูเรีย (46-0-0) ประมาณ 5–10 กก./ไร่ ช่วงข้าวเริ่มสร้างรวงอ่อน',
        day: panicleDay,
        window: 5,
      ),
      FieldTask(
        id: 'water',
        kind: 'water',
        title: 'รักษาระดับน้ำในแปลง',
        detail: 'ช่วงตั้งท้องถึงออกรวงข้าวต้องการน้ำมาก รักษาระดับน้ำ 5–10 ซม. อย่าให้แปลงแห้ง',
        day: panicleDay + 5,
        window: 10,
      ),
      FieldTask(
        id: 'survey2',
        kind: 'survey',
        title: 'สำรวจโรคไหม้คอรวง',
        detail: 'ช่วงออกรวงเสี่ยงโรคไหม้คอรวง โดยเฉพาะเมื่ออากาศชื้นหรือมีหมอก ตรวจและสแกนรวงที่ผิดปกติ',
        day: floweringDay - 3,
        window: 7,
      ),
      FieldTask(
        id: 'drain',
        kind: 'water',
        title: 'ระบายน้ำออกจากแปลง',
        detail: 'ระบายน้ำออกก่อนเก็บเกี่ยว 7–10 วัน ให้ดินแห้งพอรถเกี่ยวเข้าได้และข้าวสุกสม่ำเสมอ',
        day: harvestDay - 10,
        window: 4,
      ),
      FieldTask(
        id: 'harvest',
        kind: 'harvest',
        title: 'เก็บเกี่ยวข้าว',
        detail: 'เก็บเกี่ยวระยะพลับพลึง (ประมาณ 28–30 วันหลังออกดอก) เมล็ดสุกเหลือง 80–85% ของรวง',
        day: harvestDay,
        window: 7,
      ),
    ];
  }

  TaskState stateOf(FieldTask t, [int? day]) {
    final d = day ?? today;
    if (field.taskLog.containsKey(t.id)) return TaskState.done;
    if (d > t.day + t.window) return TaskState.overdue;
    if (d >= t.day - 2) return TaskState.now;
    return TaskState.upcoming;
  }

  /// The most urgent unfinished job (overdue first, then current, then next).
  FieldTask? get nextTask {
    final open = tasks.where((t) => stateOf(t) != TaskState.done).toList();
    for (final s in [TaskState.overdue, TaskState.now, TaskState.upcoming]) {
      final hit = open.where((t) => stateOf(t) == s);
      if (hit.isNotEmpty) return hit.first;
    }
    return null;
  }
}

/// An entry in the field diary.
class FieldLog {
  FieldLog({this.id = '', required this.type, required this.date, this.note = '', this.cost});

  final String id;

  /// fertilizer | spray | water | weed | survey | other
  final String type;
  final DateTime date;
  final String note;
  final double? cost;

  static const types = {
    'fertilizer': 'ใส่ปุ๋ย',
    'spray': 'พ่นยา/ชีวภัณฑ์',
    'water': 'จัดการน้ำ',
    'weed': 'กำจัดวัชพืช',
    'survey': 'สำรวจแปลง',
    'other': 'อื่น ๆ',
  };

  String get typeLabel => types[type] ?? 'อื่น ๆ';

  factory FieldLog.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return FieldLog(
      id: doc.id,
      type: d['type'] as String? ?? 'other',
      date: (d['date'] as Timestamp?)?.toDate() ?? DateTime.now(),
      note: d['note'] as String? ?? '',
      cost: (d['cost'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toData() => {
        'type': type,
        'date': Timestamp.fromDate(date),
        'note': note.trim(),
        'cost': cost,
      };
}
