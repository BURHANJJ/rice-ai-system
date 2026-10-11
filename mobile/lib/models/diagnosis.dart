class DiagnosisResult {
  final String diagnosisId;
  final String diseaseName;
  final String diseaseCode;
  final double confidence;
  final String symptoms;
  final String cause;
  final List<AdviceItem> advice;
  final String disclaimer;
  final String? province;
  final String aiSource;
  final String? aiWarning;

  DiagnosisResult({
    required this.diagnosisId,
    required this.diseaseName,
    required this.diseaseCode,
    required this.confidence,
    required this.symptoms,
    required this.cause,
    required this.advice,
    required this.disclaimer,
    required this.aiSource,
    this.province,
    this.aiWarning,
  });

  factory DiagnosisResult.fromJson(Map<String, dynamic> j) => DiagnosisResult(
        diagnosisId: j['diagnosis_id'],
        diseaseName: j['disease_name'],
        diseaseCode: j['disease_code'],
        confidence: (j['confidence'] as num).toDouble(),
        symptoms: j['symptoms'] ?? '',
        cause: j['cause'] ?? '',
        advice: (j['advice'] as List? ?? []).map((a) => AdviceItem.fromJson(a)).toList(),
        disclaimer: j['disclaimer'] ?? '',
        aiSource: j['ai_source'] ?? '',
        aiWarning: j['ai_warning'],
        province: j['location']?['province'],
      );
}

class AdviceItem {
  final String treatment;
  final String? chemicalName;
  final String? dosage;
  AdviceItem({required this.treatment, this.chemicalName, this.dosage});
  factory AdviceItem.fromJson(Map<String, dynamic> j) => AdviceItem(
        treatment: j['treatment'] ?? '',
        chemicalName: j['chemical_name'],
        dosage: j['dosage'],
      );
}

class HistoryEntry {
  final String diagId;
  final String diseaseName;
  final double confidence;
  final String diagDate;
  final String? province;
  HistoryEntry(
      {required this.diagId,
      required this.diseaseName,
      required this.confidence,
      required this.diagDate,
      this.province});
  factory HistoryEntry.fromJson(Map<String, dynamic> j) => HistoryEntry(
        diagId: j['diag_id'],
        diseaseName: j['disease_name'],
        confidence: (j['confidence'] as num).toDouble(),
        diagDate: j['diag_date'],
        province: j['province'],
      );
}

class ProvinceStat {
  final String province;
  final String region;
  final int totalCases;
  final String riskLevel;
  final double? latitude;
  final double? longitude;
  ProvinceStat(
      {required this.province,
      required this.region,
      required this.totalCases,
      required this.riskLevel,
      this.latitude,
      this.longitude});
  factory ProvinceStat.fromJson(Map<String, dynamic> j) => ProvinceStat(
        province: j['province'],
        region: j['region'],
        totalCases: j['total_cases'],
        riskLevel: j['risk_level'],
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
      );
}
