import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api, ApiError, type CaseRow } from "../lib/api";
import { hashFile, shortHash, type HashedFile } from "../lib/hash";
import { Button, Card, Checklist, Empty, Loading, Notice } from "../components";
import { colours, styles } from "../theme";

/**
 * Field evidence capture.
 *
 * The order is the point: photograph, hash on the device, take a position fix,
 * then register. The submit control stays unavailable until all three exist, so
 * an officer cannot half-record an item and find out later.
 *
 * The digest is computed here from the file's raw bytes. The server recomputes it
 * over what arrives and refuses the upload if they differ, so a corrupted
 * transfer is caught rather than registered.
 */
export function CaptureScreen() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string>("");

  const [picked, setPicked] = useState<HashedFile | null>(null);
  const [hashing, setHashing] = useState(false);
  const [fix, setFix] = useState<Location.LocationObjectCoords | null>(null);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    chainEvidenceId: number | null;
    txHash: string;
    flagged: boolean;
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<{ cases: CaseRow[] }>("/api/cases");
        // Only cases with write access can take new evidence.
        const writable = data.cases.filter((row) => row.access !== "read");
        setCases(writable);
        if (writable.length === 1) setCaseId(writable[0].id);
      } catch (caught) {
        setLoadError(caught instanceof ApiError ? caught.message : "Could not load your cases.");
      }
    })();
  }, []);

  const capture = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        fromCamera
          ? "NyaySetu needs the camera to photograph evidence at the scene."
          : "NyaySetu needs photo access to attach an existing image."
      );
      return;
    }

    const picker = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const outcome = await picker({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      // No editing: cropping an evidence photograph changes the bytes, and the
      // whole point of the digest is that the bytes are not changed.
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (outcome.canceled || !outcome.assets?.[0]) return;
    const asset = outcome.assets[0];

    setHashing(true);
    setError(null);
    setResult(null);
    try {
      setPicked(
        await hashFile(
          asset.uri,
          asset.fileName ?? `evidence-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`,
          asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg")
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not hash that file.");
      setPicked(null);
    } finally {
      setHashing(false);
    }
  };

  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Location permission was refused. Evidence is registered with the coordinates where it was collected, so this is required."
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setFix(position.coords);
    } catch {
      setError("Could not get a position fix. Move somewhere with a clearer view of the sky.");
    } finally {
      setLocating(false);
    }
  };

  const register = async () => {
    if (!picked || !fix || !caseId) return;

    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      // React Native's fetch understands this shape and streams from disk.
      form.append("file", {
        uri: picked.uri,
        name: picked.name,
        type: picked.mimeType,
      } as unknown as Blob);
      form.append("caseId", caseId);
      form.append("clientHash", picked.hash);
      form.append("kind", picked.mimeType.startsWith("video") ? "video" : "photo");
      form.append("gpsLat", String(fix.latitude));
      form.append("gpsLng", String(fix.longitude));
      form.append("collectedAt", new Date().toISOString());
      form.append("deviceReportedMtime", picked.lastModified);
      if (notes.trim()) form.append("notes", notes.trim());

      const outcome = await api.upload<{
        chain: { chainEvidenceId: number | null; txHash: string };
        screening: { available: boolean; anomaly: boolean; reasons: string[] };
      }>("/api/evidence", form);

      setResult({
        chainEvidenceId: outcome.chain.chainEvidenceId,
        txHash: outcome.chain.txHash,
        flagged: outcome.screening.available && outcome.screening.anomaly,
        reasons: outcome.screening.reasons ?? [],
      });
      setPicked(null);
      setNotes("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Notice tone="danger" title="Could not load your cases" body={loadError} />
      </ScrollView>
    );
  }

  if (cases === null) {
    return (
      <View style={styles.screen}>
        <Loading label="Loading your cases" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={styles.eyebrow}>SaakshyaSetu</Text>
        <Text style={styles.h1}>Capture evidence</Text>
        <Text style={[styles.body, { marginTop: 6 }]}>
          The digest is computed on this phone before anything is uploaded.
        </Text>
      </View>

      {result ? (
        <Card title="Registered on chain" borderColor={colours.successSoft}>
          <Notice
            tone={result.flagged ? "warning" : "success"}
            title={
              result.flagged
                ? `Registered as #${result.chainEvidenceId}, and flagged at intake`
                : `Registered as evidence #${result.chainEvidenceId}`
            }
            body={
              result.flagged
                ? result.reasons[0] ??
                  "Screening found something unusual. The verdict is anchored and cannot be removed."
                : "The digest, coordinates and timestamp are now on chain."
            }
          />
          <Text style={styles.mono}>{shortHash(result.txHash, 14, 10)}</Text>
          <Button label="Capture another" variant="ghost" onPress={() => setResult(null)} />
        </Card>
      ) : null}

      {cases.length === 0 ? (
        <Empty
          title="No case with write access"
          body="Register an FIR from the web portal, or ask the court administrator to assign you write access."
        />
      ) : (
        <>
          <Card title="1 · Case">
            <View style={{ gap: 8 }}>
              {cases.map((row) => {
                const active = row.id === caseId;
                return (
                  <Pressable
                    key={row.id}
                    onPress={() => setCaseId(row.id)}
                    style={{
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: active ? colours.primarySoft : colours.surface2,
                      borderColor: active ? colours.primary : colours.border,
                    }}
                  >
                    <Text style={{ color: colours.text, fontSize: 14, fontWeight: "600" }}>
                      {row.title}
                    </Text>
                    <Text style={[styles.mono, { marginTop: 3, color: colours.muted }]}>
                      {row.fir_number}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card title="2 · The item" subtitle="Hashed with SHA-256 on this device.">
            {picked ? (
              <View style={{ gap: 10 }}>
                <KeyRow label="File" value={picked.name} />
                <KeyRow label="Size" value={`${(picked.sizeBytes / 1024).toFixed(0)} KB`} />
                <View
                  style={{
                    backgroundColor: colours.surface2,
                    borderColor: colours.primary,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text style={styles.label}>SHA-256 going on chain</Text>
                  <Text style={[styles.mono, { fontSize: 10 }]}>{picked.hash}</Text>
                </View>
                <Button label="Choose a different item" variant="ghost" onPress={() => setPicked(null)} />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Button
                  label={hashing ? "Hashing…" : "Photograph it"}
                  loading={hashing}
                  onPress={() => void capture(true)}
                />
                <Button
                  label="Attach from library"
                  variant="ghost"
                  disabled={hashing}
                  onPress={() => void capture(false)}
                />
              </View>
            )}
          </Card>

          <Card title="3 · Position" subtitle="Recorded on chain with the digest and the timestamp.">
            {fix ? (
              <>
                <KeyRow
                  label="Coordinates"
                  value={`${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`}
                />
                <KeyRow label="Accuracy" value={`±${Math.round(fix.accuracy ?? 0)} m`} />
                <Button label="Refresh fix" variant="ghost" loading={locating} onPress={() => void locate()} />
              </>
            ) : (
              <Button
                label="Capture position"
                loading={locating}
                onPress={() => void locate()}
              />
            )}
          </Card>

          <Card title="Notes" subtitle="Where it was found, and in what condition. Stored off chain.">
            <TextInput
              style={[styles.input, { minHeight: 84, textAlignVertical: "top" }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Seized from the rear entrance, bagged and sealed on site."
              placeholderTextColor={colours.faint}
            />
          </Card>

          <Card title="Ready?">
            <Checklist
              items={[
                { done: Boolean(caseId), label: "Case selected" },
                { done: Boolean(picked), label: "Item hashed on this device" },
                { done: Boolean(fix), label: "Position captured" },
              ]}
            />

            {error ? <Notice tone="danger" title="Registration refused" body={error} /> : null}

            <Button
              label="Register on chain"
              loading={submitting}
              disabled={!caseId || !picked || !fix}
              onPress={() => void register()}
            />
            <Text style={styles.small}>
              The file is encrypted before it leaves this phone&apos;s network request and pinned to
              IPFS. Only the digest, the coordinates and your Aadhaar token go on chain.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{ color: colours.text, fontSize: 12, flexShrink: 1, textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}
