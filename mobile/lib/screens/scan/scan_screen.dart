import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:remixicon/remixicon.dart';

import '../../models/diagnosis.dart';
import '../../models/rice_field.dart';
import '../../services/field_service.dart';
import '../fields/field_detail_screen.dart';
import '../fields/widgets/field_widgets.dart';
import '../history/history_detail_screen.dart';
import '../../services/offline_classifier_stub.dart' if (dart.library.ffi) '../../services/offline_classifier.dart';
import '../../services/location_helper.dart';
import '../../services/scan_exception.dart';
import '../../services/navigation_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import '../wiki/data/rice_department_data.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> with SingleTickerProviderStateMixin {
  XFile? _image;
  Position? _position;
  String? _locationNote;
  DiagnosisResult? _result;
  (RiceField, double)? _matchedField;
  bool _busy = false;
  // What went wrong with the last analyse/save. Stays on screen until the farmer acts on it.
  _ScanIssue? _issue;
  int _issueSeq = 0;
  final _issueKey = GlobalKey();

  // The model ships inside the app (model v3, test-set accuracy 96.85%), so it is always available.
  static const _aiAccuracy = '96.9%';

  late AnimationController _scanController;
  Timer? _phaseTimer;
  int _phase = 0;
  static const _phases = ['กำลังอ่านภาพใบข้าว', 'ระบุตำแหน่งแปลงนา', 'AI กำลังวิเคราะห์โรค', 'กำลังบันทึกผล'];

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _phaseTimer?.cancel();
    _scanController.dispose();
    super.dispose();
  }

  int get _currentStep {
    if (_result != null) return 3;
    if (_image != null) return 2;
    return 1;
  }

  Future<void> _pickImage(ImageSource source) async {
    // Compress heavily to keep the Base64 string well under Firestore's 1MB limit
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 60,
      maxWidth: 800,
      maxHeight: 800,
    );
    if (picked == null) return;
    HapticFeedback.selectionClick();
    setState(() {
      _image = picked;
      _result = null;
      _issue = null;
    });
  }

  Future<void> _requestLocation() async {
    setState(() => _locationNote = null);
    try {
      final permission = await Geolocator.checkPermission();
      var granted = permission;
      if (permission == LocationPermission.denied) {
        granted = await Geolocator.requestPermission();
      }
      if (granted == LocationPermission.denied || granted == LocationPermission.deniedForever) {
        setState(() => _locationNote = 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง');
        return;
      }
      // A cold GPS fix without internet assistance can take minutes; fall back to the last fix.
      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(timeLimit: Duration(seconds: 15)));
      } on TimeoutException {
        pos = await Geolocator.getLastKnownPosition();
      }
      if (pos == null) {
        setState(() => _locationNote = 'ยังหาตำแหน่งไม่ได้ ลองออกไปที่โล่งแล้วกดอีกครั้ง');
        return;
      }
      setState(() => _position = pos);

      final address = await LocationHelper.getThaiAddress(pos);
      setState(() => _locationNote = address);
    } catch (_) {
      setState(() => _locationNote = 'ไม่สามารถอ่านตำแหน่งได้ในขณะนี้');
    }
  }

  void _startPhases() {
    _phase = 0;
    _phaseTimer?.cancel();
    _phaseTimer = Timer.periodic(const Duration(milliseconds: 1400), (_) {
      if (mounted && _phase < _phases.length - 1) setState(() => _phase++);
    });
  }

  Future<void> _analyze() async {
    if (_image == null) return; // the analyse button only exists once a photo is chosen
    setState(() {
      _busy = true;
      _issue = null;
    });
    _startPhases();
    try {
      // 0. Request location first so it's ready for the result screen
      await _requestLocation();

      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('กรุณาเข้าสู่ระบบก่อนใช้งาน (Firebase Auth required)');

      final bytes = await _image!.readAsBytes();

      // 1. The AI runs on this phone (TFLite), so scanning works with no signal at all.
      final data = await OfflineClassifier.instance.diagnose(bytes);
      if (_position != null) {
        data['location'] = {
          'latitude': _position!.latitude,
          'longitude': _position!.longitude,
          'province': _provinceFromNote()
        };
      }

      // 2. The classifier also returns a ≤800 px JPEG so the record fits Firestore's 1 MB limit.
      final base64Image = data['compressed_base64'] ?? base64Encode(bytes);

      // Pre-match field if position is already known
      (RiceField, double)? initialMatched;
      if (_position != null) {
        try {
          initialMatched = await FieldService.nearestField(_position!.latitude, _position!.longitude);
        } catch (_) {}
      }

      // 3. Save to Firestore (Diagnoses collection)
      final diagData = {
        'user_id': user.uid,
        'disease_code': data['disease_code'],
        'disease_name': data['disease_name'],
        'confidence': data['confidence'],
        'diag_date': FieldValue.serverTimestamp(),
        'image_base64': base64Image, // Save the Base64 string directly
        'advice': data['advice'],
        'ai_source': data['ai_source'],
        if (initialMatched != null) ...{
          'field_id': initialMatched.$1.id,
          'field_name': initialMatched.$1.name,
        },
        'location': _position != null
            ? {
                'latitude': _position!.latitude,
                'longitude': _position!.longitude,
                'province': data['location']?['province'],
              }
            : null,
      };

      // Firestore applies the write locally at once and syncs when there's signal. Awaiting it
      // would wait for the server, which never answers in a field with no internet.
      final docRef = FirebaseFirestore.instance.collection('diagnoses').doc();
      unawaited(docRef.set(diagData).catchError((Object e) => debugPrint('diagnosis sync failed: $e')));

      // 4. Auto-create notification in Firestore
      final isDisease = data['disease_code'] != 'HEALTHY';
      final diseaseName = (data['disease_name'] as String? ?? '').replaceAll('โรคไหม้', 'โรคใบไหม้');
      unawaited(FirebaseFirestore.instance.collection('notifications').add({
        'user_id': user.uid,
        'type': isDisease ? 'disease_alert' : 'scan_result',
        'title': isDisease ? 'ตรวจพบ: $diseaseName' : 'ผลสแกน: ข้าวปกติ',
        'body': isDisease
            ? 'ระบบ AI ตรวจพบ$diseaseName ด้วยความมั่นใจ ${(data['confidence'] as num).toStringAsFixed(1)}% กรุณาเฝ้าระวังแปลงนาอย่างใกล้ชิด'
            : 'ระบบ AI วิเคราะห์ผลแล้ว ไม่พบสัญญาณของโรค ใบข้าวมีสุขภาพดี',
        'is_read': false,
        'diagnosis_id': docRef.id,
        'location': _locationNote,
        'created_at': FieldValue.serverTimestamp(),
      }).then((_) {}, onError: (Object e) => debugPrint('notification sync failed: $e')));

      // Inject doc ID so local model parses it
      data['diagnosis_id'] = docRef.id;
      HapticFeedback.heavyImpact();
      _matchedField = initialMatched;
      setState(() => _result = DiagnosisResult.fromJson(data));
      if (_matchedField == null) {
        _matchField();
      }
    } catch (e) {
      _fail(_ScanIssue.from(e));
    } finally {
      _phaseTimer?.cancel();
      if (mounted) setState(() => _busy = false);
    }
  }

  /// "ต.ท่าวังทอง อ.เมืองพะเยา จ.พะเยา" -> "พะเยา" (offline results have no server-side lookup).
  String? _provinceFromNote() => RegExp(r'จ\.(\S+)').firstMatch(_locationNote ?? '')?.group(1);

  Future<void> _saveWithGps() async {
    final result = _result;
    if (result == null) return;
    setState(() => _busy = true);
    var synced = false;
    try {
      await _requestLocation();

      if (_position != null) {
        if (_matchedField == null) {
          try {
            _matchedField = await FieldService.nearestField(_position!.latitude, _position!.longitude);
          } catch (_) {}
        }

        final updateData = <String, dynamic>{
          'location': {
            'latitude': _position!.latitude,
            'longitude': _position!.longitude,
            'province': _locationNote ?? 'พิกัดปัจจุบัน',
            'address': _locationNote ?? 'พิกัดปัจจุบัน',
          }
        };
        if (_matchedField != null) {
          updateData['field_id'] = _matchedField!.$1.id;
          updateData['field_name'] = _matchedField!.$1.name;
        }

        unawaited(FirebaseFirestore.instance
            .collection('diagnoses')
            .doc(result.diagnosisId)
            .update(updateData)
            .then((_) {}, onError: (Object e) => debugPrint('location sync failed: $e')));
      }

      // Firestore keeps writes on the phone until there's signal. Wait briefly so the
      // summary can say honestly whether the scan already reached the system.
      try {
        await FirebaseFirestore.instance.waitForPendingWrites().timeout(const Duration(seconds: 4));
        synced = true;
      } catch (_) {}
    } catch (e) {
      _fail(_ScanIssue.from(e, saving: true));
      return;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;

    // Stays until the farmer picks what to do next (no auto-close, no surprise jump).
    HapticFeedback.mediumImpact();
    final next = await showAppSheet<_AfterSave>(
      context,
      builder: (_) => _SavedSheet(
        result: result,
        place: _position != null ? _locationNote : null,
        field: _matchedField?.$1.name,
        synced: synced,
      ),
    );
    if (!mounted) return;
    _reset();
    switch (next) {
      case _AfterSave.history:
        await Navigator.push(context, MaterialPageRoute(builder: (_) => HistoryDetailScreen(diagId: result.diagnosisId)));
      case _AfterSave.home:
        context.read<NavigationProvider>().setIndex(0);
      case _AfterSave.scan || null:
        break; // ready for the next leaf
    }
  }

  /// Links the scan to the farmer's field it was taken in (if they keep fields).
  Future<void> _matchField() async {
    if (_matchedField != null) return;
    if (_position == null) return;
    try {
      final m = await FieldService.nearestField(_position!.latitude, _position!.longitude);
      if (mounted && m != null) {
        setState(() => _matchedField = m);
        final diagId = _result?.diagnosisId;
        if (diagId != null) {
          unawaited(FirebaseFirestore.instance.collection('diagnoses').doc(diagId).update({
            'field_id': m.$1.id,
            'field_name': m.$1.name,
          }).catchError((_) {}));
        }
      }
    } catch (_) {}
  }

  void _reset() {
    setState(() {
      _matchedField = null;
      _image = null;
      _result = null;
      _issue = null;
    });
  }

  /// Shows [issue] as a card in the page (not a toast), shakes it once and scrolls it into view.
  void _fail(_ScanIssue issue) {
    if (!mounted) return;
    HapticFeedback.heavyImpact();
    setState(() {
      _issue = issue;
      _issueSeq++;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _issueKey.currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 420), curve: Curves.easeOutCubic, alignment: 0.15);
    });
  }

  Future<void> _retake() async {
    setState(() => _issue = null);
    await _pickImage(ImageSource.camera);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Build
  // ───────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Scaffold(
      backgroundColor: p.bg,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 450),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (c, a) => FadeTransition(
          opacity: a,
          child: SlideTransition(position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(a), child: c),
        ),
        child: _result != null
            ? KeyedSubtree(key: const ValueKey('result'), child: _buildResultScreen())
            : KeyedSubtree(key: const ValueKey('capture'), child: _buildCaptureScreen()),
      ),
    );
  }

  Widget _buildCaptureScreen() {
    final p = context.pal;
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 14, 20, 130),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('สแกนใบข้าว', style: AppText.display(24, color: p.ink))),
              const SizedBox(width: 10),
              Flexible(child: _buildStatusBadge()),
            ],
          ),
          const SizedBox(height: 16),
          _buildStepper(),
          const SizedBox(height: 18),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 380),
            transitionBuilder: (c, a) => FadeTransition(
                opacity: a, child: ScaleTransition(scale: Tween(begin: 0.96, end: 1.0).animate(a), child: c)),
            child: _currentStep == 1
                ? Column(
                    key: const ValueKey('pick'),
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildCameraPlaceholder(),
                      const SizedBox(height: 14),
                      _buildActionButtons(),
                      const SizedBox(height: 14),
                      _buildTips(),
                      const SizedBox(height: 22),
                      _buildSupportedDiseases(),
                    ],
                  )
                : Column(
                    key: const ValueKey('preview'),
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildImagePreview(),
                      const SizedBox(height: 16),
                      _buildAnalyzeSection(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepper() {
    final p = context.pal;
    const labels = ['เลือกภาพ', 'วิเคราะห์', 'ผลลัพธ์'];
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(color: p.line, borderRadius: BorderRadius.circular(1)),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: _currentStep > i ? 1 : 0,
                  child: Container(color: p.primary),
                ),
              ),
            ),
          _buildStepItem(i + 1, labels[i]),
        ],
      ],
    );
  }

  Widget _buildStepItem(int stepNumber, String label) {
    final p = context.pal;
    final isActive = _currentStep >= stepNumber;
    final isDone = _currentStep > stepNumber;
    // On narrow phones only the current step keeps its label.
    final showLabel = _currentStep == stepNumber || MediaQuery.of(context).size.width >= 390;
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: isActive ? p.primary : Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(color: isActive ? p.primary : p.line, width: 1.5),
          ),
          alignment: Alignment.center,
          child: isDone
              ? const Icon(Remix.check_line, size: 15, color: Colors.white)
              : Text(
                  '$stepNumber',
                  style:
                      TextStyle(color: isActive ? Colors.white : p.muted, fontWeight: FontWeight.w700, fontSize: 12.5),
                ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          child: showLabel
              ? Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: _currentStep == stepNumber ? FontWeight.w700 : FontWeight.w500,
                      color: isActive ? p.primaryText : p.muted,
                    ),
                  ),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }

  Widget _buildStatusBadge() {
    final p = context.pal;
    final (fg, bg) = context.tone(Tone.safe);
    const label = 'AI บนเครื่อง';
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          PulseDot(color: fg, size: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
          Container(width: 1, height: 12, margin: const EdgeInsets.symmetric(horizontal: 8), color: fg.withOpacity(0.3)),
          Text(_aiAccuracy, style: TextStyle(color: p.body, fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildCameraPlaceholder() {
    return Semantics(
      button: true,
      label: 'ถ่ายภาพใบข้าว',
      child: Pressable(
        onTap: () => _pickImage(ImageSource.camera),
        scale: 0.985,
        child: Container(
          height: 290,
          decoration: BoxDecoration(color: AppColors.forestDeep, borderRadius: BorderRadius.circular(26)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(26),
            child: Stack(
              fit: StackFit.expand,
              children: [
                CustomPaint(painter: CornerFramePainter(length: 34, stroke: 3.5, inset: 30)),
                AnimatedBuilder(
                  animation: _scanController,
                  builder: (_, __) => Align(
                    alignment: Alignment(0, -0.62 + 1.24 * Curves.easeInOut.transform(_scanController.value)),
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.symmetric(horizontal: 46),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7BD389).withOpacity(0.85),
                        boxShadow: [
                          BoxShadow(color: const Color(0xFF7BD389).withOpacity(0.5), blurRadius: 12, spreadRadius: 1)
                        ],
                      ),
                    ),
                  ),
                ),
                const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Remix.leaf_line, size: 54, color: Color(0xFFA7C4B0)),
                    SizedBox(height: 12),
                    Text('วางใบข้าวให้อยู่ในกรอบ',
                        style: TextStyle(color: Colors.white, fontSize: 15.5, fontWeight: FontWeight.w600)),
                    SizedBox(height: 2),
                    Text('แตะเพื่อเปิดกล้อง', style: TextStyle(color: Color(0xFFA7C4B0), fontSize: 12.5)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Row(
      children: [
        Expanded(
          child:
              AppButton(label: 'ถ่ายภาพ', icon: Remix.camera_3_line, onPressed: () => _pickImage(ImageSource.camera)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: AppButton(
            label: 'คลังภาพ',
            icon: Remix.image_add_line,
            kind: ButtonKind.secondary,
            onPressed: () => _pickImage(ImageSource.gallery),
          ),
        ),
      ],
    );
  }

  Widget _buildTips() {
    final p = context.pal;
    const tips = [
      (Remix.sun_line, 'แสงสว่างพอ', Tone.warn),
      (Remix.focus_3_line, 'ใบเต็มกรอบ', Tone.primary),
      (Remix.search_eye_line, 'เห็นรอยโรค', Tone.info),
    ];
    return Row(
      children: [
        for (var i = 0; i < tips.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: p.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: p.line),
              ),
              child: Column(
                children: [
                  Icon(tips[i].$1, size: 18, color: context.tone(tips[i].$3).$1),
                  const SizedBox(height: 4),
                  Text(tips[i].$2, style: TextStyle(fontSize: 11.5, color: p.body, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSupportedDiseases() {
    final p = context.pal;
    final diseases = [
      {'tone': Tone.danger, 'icon': Remix.fire_line, 'name': 'โรคใบไหม้', 'sci': 'Pyricularia oryzae'},
      {'tone': Tone.warn, 'icon': Remix.leaf_line, 'name': 'ขอบใบแห้ง', 'sci': 'Xanthomonas oryzae'},
      {'tone': Tone.info, 'icon': Remix.sun_line, 'name': 'ใบสีส้ม (Tungro)', 'sci': 'Rice Tungro Virus'},
      {'tone': Tone.safe, 'icon': Remix.checkbox_circle_line, 'name': 'ข้าวปกติ', 'sci': 'Healthy Rice'},
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: 'โรคที่ระบบรองรับ',
          trailing: StatusPill(label: '${diseases.length} ประเภท', tone: Tone.primary, dot: false),
        ),
        const SizedBox(height: 12),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(
            children: [
              for (var i = 0; i < diseases.length; i++) ...[
                if (i > 0) Divider(height: 1, color: p.line),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: [
                      IconTile(icon: diseases[i]['icon'] as IconData, tone: diseases[i]['tone'] as Tone, size: 36),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(diseases[i]['name'] as String,
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.ink)),
                            Text(
                              diseases[i]['sci'] as String,
                              style: TextStyle(fontSize: 11.5, color: p.muted, fontStyle: FontStyle.italic),
                            ),
                          ],
                        ),
                      ),
                      Icon(Remix.check_line, size: 17, color: context.tone(diseases[i]['tone'] as Tone).$1),
                    ],
                  ),
                ),
              ],
              Divider(height: 1, color: p.line),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Icon(Remix.information_line, size: 13, color: p.faint),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'ข้อมูลอ้างอิงจากกรมการข้าว ประเทศไทย • ความแม่นยำบนชุดทดสอบ $_aiAccuracy',
                        style: TextStyle(fontSize: 11.5, color: p.muted),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _imageWidget() =>
      kIsWeb ? Image.network(_image!.path, fit: BoxFit.cover) : Image.file(File(_image!.path), fit: BoxFit.cover);

  Widget _buildImagePreview() {
    return Container(
      height: 340,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _imageWidget(),
          AnimatedOpacity(
            duration: const Duration(milliseconds: 300),
            opacity: _busy ? 1 : 0,
            child: Container(color: AppColors.forestDeep.withOpacity(0.45)),
          ),
          CustomPaint(painter: CornerFramePainter(length: 30, stroke: 3.5, inset: 18)),
          if (_busy)
            AnimatedBuilder(
              animation: _scanController,
              builder: (context, child) => Align(
                alignment: Alignment(0, -0.9 + 1.8 * _scanController.value),
                child: Container(
                  height: 3,
                  margin: const EdgeInsets.symmetric(horizontal: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7BD389),
                    boxShadow: [
                      BoxShadow(color: const Color(0xFF7BD389).withOpacity(0.8), blurRadius: 10, spreadRadius: 2),
                      BoxShadow(color: const Color(0xFF7BD389).withOpacity(0.35), blurRadius: 26, spreadRadius: 6),
                    ],
                  ),
                ),
              ),
            ),
          if (_busy)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Container(
                padding: const EdgeInsets.fromLTRB(6, 4, 14, 4),
                decoration: BoxDecoration(
                  color: AppColors.forestDeep.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Ricey(mood: RiceyMood.scan, size: 46, interactive: false),
                    const SizedBox(width: 8),
                    Expanded(
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        transitionBuilder: (c, a) => FadeTransition(
                          opacity: a,
                          child: SlideTransition(
                              position: Tween(begin: const Offset(0, 0.5), end: Offset.zero).animate(a), child: c),
                        ),
                        child: Text(
                          _phases[_phase],
                          key: ValueKey(_phase),
                          style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    Text('${_phase + 1}/${_phases.length}',
                        style: const TextStyle(color: Color(0xFFA7C4B0), fontSize: 12)),
                  ],
                ),
              ),
            ),
          if (!_busy)
            Positioned(
              top: 14,
              right: 14,
              child: Semantics(
                button: true,
                label: 'ลบภาพ',
                child: Pressable(
                  onTap: _reset,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: Colors.black.withOpacity(0.5), shape: BoxShape.circle),
                    child: const Icon(Remix.close_line, color: Colors.white, size: 20),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// The problem card: what happened, why, what to try, and the buttons to do it.
  /// [onResult]: shown above the save button on the result page (the save button is the retry).
  Widget _buildIssueCard(_ScanIssue i, {bool onResult = false}) {
    final p = context.pal;
    final (fg, soft) = context.tone(i.tone);
    final actions = onResult ? const <Widget>[] : _issueActions(i);
    return KeyedSubtree(
      key: _issueKey,
      child: ShakeOnChange(
        trigger: _issueSeq,
        child: FadeSlideIn(
          key: ValueKey(_issueSeq),
          child: Container(
            decoration: BoxDecoration(
              color: p.surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: fg.withOpacity(0.28)),
              boxShadow: [BoxShadow(color: fg.withOpacity(0.10), blurRadius: 24, offset: const Offset(0, 10))],
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // header
                Container(
                  color: soft,
                  padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Ricey(mood: i.mood, size: 62, interactive: false),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            StatusPill(label: i.tag, tone: i.tone),
                            const SizedBox(height: 6),
                            Text(i.title, style: AppText.display(17.5, color: p.ink)),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'ปิด',
                        onPressed: () => setState(() => _issue = null),
                        icon: Icon(Remix.close_line, color: p.muted, size: 20),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(i.message, style: TextStyle(fontSize: 14, height: 1.6, color: p.body)),
                      if (i.kind == _IssueKind.outOfScope) ...[
                        const SizedBox(height: 12),
                        Text('AI ตรวจได้ตอนนี้', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: p.muted)),
                        const SizedBox(height: 6),
                        Wrap(spacing: 6, runSpacing: 6, children: [
                          for (final d in const ['โรคใบไหม้', 'โรคขอบใบแห้ง', 'โรคใบสีส้ม', 'ใบปกติ'])
                            StatusPill(label: d, tone: Tone.neutral, dot: false),
                        ]),
                      ],
                      if (i.tips.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Text(i.tipsTitle, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.ink)),
                        const SizedBox(height: 4),
                        for (final (n, t) in i.tips.indexed)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Container(
                                width: 22,
                                height: 22,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: soft, borderRadius: BorderRadius.circular(7)),
                                child: Text('${n + 1}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: fg)),
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text(t, style: TextStyle(fontSize: 13.5, height: 1.5, color: p.body))),
                            ]),
                          ),
                      ],
                      if (actions.isNotEmpty) ...[const SizedBox(height: 16), ...actions],
                      if (i.detail != null) _issueDetail(i.detail!),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _issueActions(_ScanIssue i) {
    final (primary, secondary) = switch (i.kind) {
      _IssueKind.retake => (
          AppButton(label: 'ถ่ายภาพใหม่', icon: Remix.camera_3_line, onPressed: _retake),
          AppButton(label: 'เลือกจากคลังภาพ', icon: Remix.image_2_line, kind: ButtonKind.secondary,
              onPressed: () => _pickImage(ImageSource.gallery)),
        ),
      _IssueKind.outOfScope => (
          AppButton(label: 'ถ่ายใบอื่นอีกครั้ง', icon: Remix.camera_3_line, onPressed: _retake),
          AppButton(label: 'ดูคลังความรู้โรคข้าว', icon: Remix.book_open_line, kind: ButtonKind.secondary,
              onPressed: () => context.read<NavigationProvider>().setIndex(3)),
        ),
      _ => (
          AppButton(label: 'ลองวิเคราะห์อีกครั้ง', icon: Remix.refresh_line, busy: _busy,
              busyLabel: 'กำลังวิเคราะห์ผล...', onPressed: _analyze),
          AppButton(label: 'เลือกภาพใหม่', icon: Remix.image_edit_line, kind: ButtonKind.secondary,
              onPressed: _busy ? null : () => _pickImage(ImageSource.gallery)),
        ),
    };
    return [primary, const SizedBox(height: 10), secondary];
  }

  /// Raw error for unexpected problems, so it can be pasted into a bug report.
  Widget _issueDetail(String detail) {
    final p = context.pal;
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: EdgeInsets.zero,
        iconColor: p.muted,
        collapsedIconColor: p.muted,
        title: Text('รายละเอียดสำหรับแจ้งปัญหา', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: p.muted)),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: p.subtle, borderRadius: BorderRadius.circular(12)),
            child: SelectableText(detail, style: TextStyle(fontSize: 12, height: 1.5, color: p.body, fontFamily: 'monospace')),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: detail));
                AppToast.success(context, 'วางในหน้าแจ้งปัญหาหรือส่งให้ทีมงานได้เลย', title: 'คัดลอกแล้ว');
              },
              icon: Icon(Remix.file_copy_line, size: 16, color: p.primaryText),
              label: Text('คัดลอก', style: TextStyle(color: p.primaryText, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnalyzeSection() {
    // Something went wrong: the card carries its own next steps (retake, gallery, retry...).
    if (_issue != null) return _buildIssueCard(_issue!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const RiceyTip(
          mood: RiceyMood.phone,
          size: 70,
          title: '$mascotNameแนะนำ',
          message: 'ภาพชัด แสงสว่าง ใบเต็มกรอบ ผลจะแม่นยำที่สุด',
        ),
        const SizedBox(height: 16),
        AppButton(
          label: 'เริ่มวิเคราะห์ด้วย AI',
          busyLabel: 'กำลังวิเคราะห์ผล...',
          icon: Remix.scan_2_line,
          busy: _busy,
          height: 58,
          onPressed: _analyze,
        ),
        const SizedBox(height: 10),
        AppButton(
          label: 'เลือกภาพใหม่',
          kind: ButtonKind.secondary,
          icon: Remix.image_edit_line,
          onPressed: _busy ? null : () => _pickImage(ImageSource.gallery),
        ),
      ],
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Result
  // ───────────────────────────────────────────────────────────────────────────

  Widget _buildResultScreen() {
    final p = context.pal;
    final isHealthy = _result!.diseaseCode == 'HEALTHY';
    final tone = isHealthy ? Tone.safe : Tone.danger;
    RiceDiseaseData? deptData;
    try {
      deptData = RiceDepartmentData.diseases.firstWhere((d) => d.code == _result!.diseaseCode);
    } catch (_) {}
    var i = 0;
    Widget step(Widget child) => FadeSlideIn.stagger(i++, child: child);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 12, 20, 130),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AppBackButton(onPressed: _reset),
              const SizedBox(width: 12),
              Expanded(child: Text('ผลการวิเคราะห์', style: AppText.display(20, color: p.ink))),
            ],
          ),
          const SizedBox(height: 16),
          step(Container(
            height: 190,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(22)),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _imageWidget(),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(
                      color: isHealthy ? AppColors.safe : AppColors.danger,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(isHealthy ? Remix.leaf_fill : Remix.bug_fill, color: Colors.white, size: 13),
                        const SizedBox(width: 6),
                        Text(
                          isHealthy ? 'สุขภาพดี' : 'ตรวจพบโรค',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          )),
          const SizedBox(height: 14),
          step(AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_result!.diseaseName, style: AppText.display(24, color: p.ink, height: 1.3)),
                      if (deptData != null)
                        Text(
                          deptData.scientificName,
                          style: TextStyle(fontSize: 12.5, color: p.muted, fontStyle: FontStyle.italic),
                        ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          StatusPill(label: isHealthy ? 'สุขภาพดี' : 'ตรวจพบโรค', tone: tone),
                          if (deptData != null && !isHealthy)
                            StatusPill(label: deptData.category, tone: Tone.neutral, dot: false),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                ConfidenceRing(percent: _result!.confidence, color: isHealthy ? p.safe : p.primary),
              ],
            ),
          )),
          const SizedBox(height: 10),
          step(RiceyTip(
            mood: isHealthy ? RiceyMood.guard : RiceyMood.worried,
            size: 72,
            tone: isHealthy ? p.safe : p.danger,
            title: isHealthy ? 'ข้าวแข็งแรงดี!' : 'พบ${_result!.diseaseName}',
            message: isHealthy
                ? 'ไม่พบสัญญาณโรค หมั่นสแกนทุกสัปดาห์เพื่อเฝ้าระวัง'
                : 'อย่าเพิ่งกังวล ดูวิธีจัดการด้านล่าง แล้วบันทึกผลเพื่อแจ้งเตือนเพื่อนบ้าน',
          )),
          if (_result!.aiSource == 'on-device-tflite') ...[
            const SizedBox(height: 10),
            step(Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: p.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: p.line)),
              child: Row(children: [
                Icon(Remix.cpu_line, size: 18, color: p.muted),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(_result!.aiWarning ?? 'AI วิเคราะห์บนเครื่องนี้ ภาพไม่ถูกส่งออก และใช้ได้แม้ไม่มีอินเทอร์เน็ต',
                        style: TextStyle(color: p.muted, fontSize: 12.5, height: 1.5))),
              ]),
            )),
          ],
          const SizedBox(height: 14),
          step(_buildLocationCard()),
          if (!isHealthy) ...[
            const SizedBox(height: 14),
            step(_buildAdviceCard(deptData)),
          ],
          if (_issue != null) ...[
            const SizedBox(height: 18),
            _buildIssueCard(_issue!, onResult: true),
          ],
          const SizedBox(height: 22),
          step(AppButton(
            label: _issue?.kind == _IssueKind.save ? 'ลองบันทึกอีกครั้ง' : 'บันทึกข้อมูล + GPS',
            busyLabel: 'กำลังบันทึกพิกัด...',
            icon: Remix.map_pin_add_line,
            busy: _busy,
            onPressed: _saveWithGps,
          )),
          const SizedBox(height: 10),
          step(AppButton(
            label: 'สแกนภาพใหม่',
            icon: Remix.camera_3_line,
            kind: ButtonKind.secondary,
            onPressed: _busy ? null : _reset,
          )),
        ],
      ),
    );
  }

  Widget _buildLocationCard() {
    final p = context.pal;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(icon: Remix.map_pin_2_line, tone: Tone.warn, size: 36),
              const SizedBox(width: 10),
              Expanded(
                  child: Text('ตำแหน่งที่สแกน',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: p.ink))),
              _position != null
                  ? const StatusPill(label: 'GPS บันทึกแล้ว', tone: Tone.safe)
                  : const StatusPill(label: 'ไม่ได้ระบุ GPS', tone: Tone.neutral, dot: false),
            ],
          ),
          if (_matchedField != null) ...[
            const SizedBox(height: 12),
            Pressable(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => FieldDetailScreen(fieldId: _matchedField!.$1.id)),
              ),
              child: Container(
                padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                decoration: BoxDecoration(color: p.primarySoft, borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    FieldAvatar(field: _matchedField!.$1, size: 34),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('สแกนในแปลง ${_matchedField!.$1.name}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.primaryText)),
                          Text('ห่างจุดปักหมุดแปลง ${distanceLabel(_matchedField!.$2)} · ดูในสมุดแปลงนา',
                              style: TextStyle(fontSize: 11.5, color: p.muted)),
                        ],
                      ),
                    ),
                    Icon(Remix.arrow_right_s_line, color: p.primaryText),
                  ],
                ),
              ),
            ),
          ],
          if (_position != null) ...[
            const SizedBox(height: 14),
            Text(_locationNote ?? 'พิกัดปัจจุบัน', style: TextStyle(fontSize: 14, color: p.ink, height: 1.4)),
            const SizedBox(height: 4),
            Text(
              '${_position!.latitude.toStringAsFixed(4)}°N, ${_position!.longitude.toStringAsFixed(4)}°E',
              style: TextStyle(fontSize: 12.5, color: p.muted, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
          const SizedBox(height: 12),
          Divider(height: 1, color: p.line),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Remix.time_line, size: 13, color: p.faint),
              const SizedBox(width: 6),
              Text(
                'บันทึกเมื่อ ${DateFormat('dd/MM/yyyy HH:mm:ss').format(DateTime.now())}',
                style: TextStyle(fontSize: 12, color: p.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAdviceCard(RiceDiseaseData? deptData) {
    final p = context.pal;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(icon: Remix.stethoscope_line, tone: Tone.danger, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ข้อมูลและคำแนะนำ', style: AppText.display(17, color: p.ink)),
                    Text('อ้างอิงข้อมูลจากกรมการข้าว และ AI', style: TextStyle(fontSize: 12, color: p.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _buildInfoSection(
            title: 'อาการที่พบเบื้องต้น',
            icon: Remix.search_eye_line,
            tone: Tone.warn,
            content: deptData?.farmerSymptoms ?? _result!.symptoms,
          ),
          const SizedBox(height: 16),
          Divider(height: 1, color: p.line),
          const SizedBox(height: 16),
          _buildInfoSection(
            title: 'วิธีแก้ไขและป้องกัน',
            icon: Remix.shield_check_line,
            tone: Tone.safe,
            content: deptData?.farmerPrevention ?? _result!.advice.map((a) => a.treatment).join('\n'),
          ),
          if (deptData != null && deptData.recommendedChemicals.isNotEmpty) ...[
            const SizedBox(height: 16),
            Divider(height: 1, color: p.line),
            const SizedBox(height: 16),
            ChemicalAdvice(chemicals: deptData.recommendedChemicals),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoSection(
      {required String title, required IconData icon, required Tone tone, required String content}) {
    if (content.isEmpty) return const SizedBox.shrink();
    final p = context.pal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: context.tone(tone).$1),
            const SizedBox(width: 8),
            Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: p.ink)),
          ],
        ),
        const SizedBox(height: 8),
        Text(content, style: TextStyle(fontSize: 14, height: 1.65, color: p.body)),
      ],
    );
  }
}

/// Recommended chemicals with a safety notice; shared by the scan result
/// and the history detail.
class ChemicalAdvice extends StatelessWidget {
  const ChemicalAdvice({super.key, required this.chemicals});
  final List<String> chemicals;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Remix.flask_line, size: 18, color: p.info),
            const SizedBox(width: 8),
            Expanded(
              child: Text('การใช้ยาเคมี (กรณีระบาดรุนแรง)',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: p.ink)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text('นำ "ชื่อสามัญ" ด้านล่างนี้ไปแจ้งร้านขายยาเกษตร:', style: TextStyle(fontSize: 13, color: p.muted)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: chemicals
              .map((chem) => Pressable(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: chem));
                      AppToast.success(context, 'คัดลอก "$chem" แล้ว นำไปแสดงที่ร้านได้เลย', title: 'คัดลอกชื่อยาแล้ว');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: p.infoSoft, borderRadius: BorderRadius.circular(12)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(chem, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.info)),
                          const SizedBox(width: 6),
                          Icon(Remix.file_copy_line, size: 13, color: p.info.withOpacity(0.7)),
                        ],
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: p.dangerSoft, borderRadius: BorderRadius.circular(12)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Remix.error_warning_line, size: 16, color: p.danger),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ข้อควรระวัง: โปรดปรึกษาร้านเคมีเกษตรก่อนใช้ และควรอ่านฉลากพร้อมผสมยาตามอัตราส่วนที่กำหนดอย่างเคร่งครัดเพื่อความปลอดภัย',
                  style: TextStyle(fontSize: 12.5, height: 1.5, color: p.danger),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

enum _AfterSave { scan, history, home }

enum _IssueKind { retake, outOfScope, model, login, save, unknown }

/// A scan problem turned into plain Thai: what happened, why it matters and what to try.
class _ScanIssue {
  const _ScanIssue({
    required this.kind,
    required this.tag,
    required this.title,
    required this.message,
    this.tips = const [],
    this.tipsTitle = 'ลองแบบนี้',
    this.detail,
  });

  final _IssueKind kind;
  final String tag;
  final String title;
  final String message;
  final List<String> tips;
  final String tipsTitle;

  /// Raw error text; shown (collapsed) only for problems the farmer can't fix by retaking.
  final String? detail;

  Tone get tone => switch (kind) {
        _IssueKind.retake => Tone.warn,
        _IssueKind.outOfScope => Tone.info,
        _ => Tone.danger,
      };

  RiceyMood get mood => switch (kind) {
        _IssueKind.retake => RiceyMood.think,
        _IssueKind.outOfScope => RiceyMood.think,
        _ => RiceyMood.worried,
      };

  factory _ScanIssue.from(Object e, {bool saving = false}) {
    final raw = e is ScanException ? '${e.code}: ${e.message}' : e.toString();
    if (saving) {
      return _ScanIssue(
        kind: _IssueKind.save,
        tag: 'ยังไม่ได้บันทึก',
        title: 'บันทึกผลไม่สำเร็จ',
        message: 'ผลวิเคราะห์ยังอยู่ครบในหน้านี้ กด "ลองบันทึกอีกครั้ง" ด้านล่างได้เลย',
        tips: const [
          'ตรวจว่าอนุญาตให้แอปใช้ตำแหน่ง (GPS) แล้ว',
          'ไม่มีสัญญาณก็บันทึกได้ ระบบจะเก็บไว้ในเครื่องแล้วส่งให้เองเมื่อมีเน็ต',
        ],
        detail: raw,
      );
    }
    final code = e is ScanException ? e.code : '';
    if (code == 'low_confidence') {
      return const _ScanIssue(
        kind: _IssueKind.retake,
        tag: 'ภาพยังไม่ชัดพอ',
        title: 'ขอภาพใหม่อีกครั้งนะ',
        message: 'AI ยังไม่มั่นใจพอจะบอกผล จึงไม่เดา เพื่อไม่ให้ได้คำแนะนำที่ผิด มักเกิดจากภาพเบลอ แสงน้อย หรือในภาพไม่ใช่ใบข้าว',
        tipsTitle: 'ถ่ายใหม่ให้ได้ผลแม่น',
        tips: [
          'ให้ใบข้าวเต็มกรอบ เห็นรอยแผลชัด ห่างประมาณหนึ่งคืบ',
          'ถ่ายในที่สว่าง หลีกเลี่ยงย้อนแสงและเงาบังแผล',
          'ถือให้นิ่ง แตะหน้าจอตรงรอยแผลให้กล้องโฟกัส',
          'ถ่ายทีละใบ ไม่มีมือหรือสิ่งอื่นในภาพมากเกินไป',
        ],
      );
    }
    if (code == 'out_of_scope') {
      return const _ScanIssue(
        kind: _IssueKind.outOfScope,
        tag: 'นอกขอบเขตของ AI',
        title: 'อาจเป็นโรคที่แอปยังไม่รองรับ',
        message: 'ลักษณะในภาพไม่ตรงกับ 4 แบบที่ AI ตรวจได้ อาจเป็นโรคหรืออาการอื่น เช่น ใบจุดสีน้ำตาล ราน้ำค้าง หรือแมลงทำลาย ระบบจึงไม่ให้ชื่อโรคที่อาจผิด',
        tipsTitle: 'ขั้นต่อไป',
        tips: [
          'เทียบอาการกับรูปในคลังความรู้โรคข้าว (22 โรคจากกรมการข้าว)',
          'ลองถ่ายใบอื่นในแปลงที่เห็นอาการชัดกว่า',
          'ถ้าอาการลุกลาม ปรึกษาเจ้าหน้าที่ส่งเสริมการเกษตรหรือศูนย์วิจัยข้าวใกล้บ้าน',
        ],
      );
    }
    if (raw.contains('เข้าสู่ระบบ') || raw.contains('Firebase Auth')) {
      return _ScanIssue(
        kind: _IssueKind.login,
        tag: 'ต้องเข้าสู่ระบบ',
        title: 'กรุณาเข้าสู่ระบบอีกครั้ง',
        message: 'ระบบต้องรู้ว่าเป็นบัญชีของใครก่อนบันทึกผลสแกน ออกจากระบบแล้วเข้าใหม่ที่หน้าโปรไฟล์ได้เลย',
        detail: raw,
      );
    }
    if (raw.contains('Interpreter') || raw.contains('tflite') || raw.contains('Unable to load asset')) {
      return _ScanIssue(
        kind: _IssueKind.model,
        tag: 'AI ยังไม่พร้อม',
        title: 'โหลด AI บนเครื่องไม่สำเร็จ',
        message: 'อาจเกิดจากหน่วยความจำเครื่องเหลือน้อยชั่วคราว',
        tips: const ['ปิดแอปอื่นที่เปิดค้างไว้ แล้วลองอีกครั้ง', 'ถ้ายังไม่ได้ ปิดแล้วเปิดแอปใหม่ หรือติดตั้งรุ่นล่าสุด'],
        detail: raw,
      );
    }
    if (raw.contains('decode') || raw.contains('FormatException') || raw.contains('Invalid image')) {
      return _ScanIssue(
        kind: _IssueKind.retake,
        tag: 'อ่านภาพไม่ได้',
        title: 'เปิดไฟล์ภาพนี้ไม่ได้',
        message: 'ไฟล์อาจเสียหรือเป็นรูปแบบที่ไม่รองรับ ลองถ่ายใหม่หรือเลือกภาพ JPG/PNG อื่น',
        detail: raw,
      );
    }
    return _ScanIssue(
      kind: _IssueKind.unknown,
      tag: 'เกิดข้อผิดพลาด',
      title: 'วิเคราะห์ไม่สำเร็จ',
      message: 'เกิดปัญหาที่ไม่คาดคิด ภาพของคุณยังอยู่ ลองอีกครั้งได้ ถ้ายังเป็นอยู่ คัดลอกรายละเอียดด้านล่างส่งให้ทีมงาน',
      detail: raw,
    );
  }
}

/// Summary shown after "บันทึกข้อมูล + GPS": what was saved, where, whether it has reached the
/// system yet, and what to do next. Stays open until the farmer chooses.
class _SavedSheet extends StatelessWidget {
  const _SavedSheet({required this.result, required this.place, required this.field, required this.synced});

  final DiagnosisResult result;
  final String? place;
  final String? field;
  final bool synced;

  @override
  Widget build(BuildContext context) {
    final p = context.pal;
    final healthy = result.diseaseCode == 'HEALTHY';
    final tone = healthy ? Tone.safe : Tone.danger;
    final (fg, _) = context.tone(tone);
    final now = DateFormat('HH:mm').format(DateTime.now());

    Widget row(IconData icon, String text, {Color? color, Widget? trailing}) => Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(children: [
            Icon(icon, size: 17, color: color ?? p.muted),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: TextStyle(fontSize: 13.5, height: 1.45, color: color ?? p.body))),
            if (trailing != null) trailing,
          ]),
        );

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Ricey(mood: RiceyMood.joy, size: 92, interactive: false),
            Text('บันทึกผลสแกนแล้ว', textAlign: TextAlign.center, style: AppText.display(21, color: p.ink)),
            const SizedBox(height: 4),
            Text(
              synced
                  ? 'ส่งเข้าระบบเรียบร้อย ผลนี้ช่วยอัปเดตแผนที่การระบาดในพื้นที่ของคุณ'
                  : 'เก็บไว้ในเครื่องแล้ว จะส่งเข้าระบบเองเมื่อมีสัญญาณอินเทอร์เน็ต',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, height: 1.5, color: p.muted),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
              decoration: BoxDecoration(
                color: p.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: p.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    IconTile(icon: healthy ? Remix.leaf_line : Remix.stethoscope_line, tone: tone, size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(result.diseaseName,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.ink)),
                    ),
                    Text('${result.confidence.toStringAsFixed(1)}%',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: fg)),
                  ]),
                  Divider(height: 22, color: p.line),
                  row(Remix.map_pin_2_line, place ?? 'ไม่ได้บันทึกพิกัด (ไม่ได้อนุญาตตำแหน่ง)'),
                  if (field != null) row(Remix.seedling_line, 'แปลง $field'),
                  row(Remix.time_line, 'วันนี้ $now น.'),
                  row(
                    synced ? Remix.cloud_line : Remix.cloud_off_line,
                    synced ? 'ซิงก์กับระบบแล้ว' : 'รอสัญญาณเพื่อซิงก์',
                    trailing: StatusPill(label: synced ? 'ออนไลน์' : 'ออฟไลน์', tone: synced ? Tone.safe : Tone.warn),
                  ),
                ],
              ),
            ),
            if (!healthy) ...[
              const SizedBox(height: 10),
              Text('แนะนำสแกนใบอื่นในแปลงเดียวกันอีก 2–3 ใบ เพื่อดูว่าโรคกระจายแค่ไหน',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, height: 1.5, color: p.muted)),
            ],
            const SizedBox(height: 18),
            AppButton(
              label: 'สแกนใบต่อไป',
              icon: Remix.camera_3_line,
              onPressed: () => Navigator.pop(context, _AfterSave.scan),
            ),
            const SizedBox(height: 10),
            AppButton(
              label: 'ดูรายละเอียดในประวัติ',
              icon: Remix.history_line,
              kind: ButtonKind.secondary,
              onPressed: () => Navigator.pop(context, _AfterSave.history),
            ),
            const SizedBox(height: 4),
            TextButton(
              onPressed: () => Navigator.pop(context, _AfterSave.home),
              child: Text('กลับหน้าหลัก', style: TextStyle(color: p.muted, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}
