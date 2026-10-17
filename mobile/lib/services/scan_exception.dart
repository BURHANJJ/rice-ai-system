/// Why a scan produced no diagnosis. [code] is 'low_confidence' (unclear photo, below the model's
/// cut-off) or 'out_of_scope' (looks like a condition the model doesn't cover); the scan screen turns
/// each into its own guidance card.
class ScanException implements Exception {
  const ScanException(this.code, this.message);
  final String code;
  final String message;

  @override
  String toString() => message;
}
