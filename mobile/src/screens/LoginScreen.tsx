import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { ApiError, apiBaseUrl, login, type User } from "../lib/api";
import { Button, Card, Notice } from "../components";
import { colours, styles } from "../theme";

/**
 * Sign in.
 *
 * The API base URL is printed on screen. That is not decoration: the single most
 * common problem when running this app is pointing it at localhost from an
 * emulator, and showing the address it is actually using makes that obvious in
 * two seconds instead of twenty minutes.
 */
export function LoginScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [email, setEmail] = useState("police@nyaysetu.demo");
  const [password, setPassword] = useState("NyaySetu@2026");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      onSignedIn(await login(email.trim(), password));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { flexGrow: 1, justifyContent: "center" }]}>
        <View style={{ alignItems: "center", marginBottom: 18, gap: 10 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              backgroundColor: colours.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24 }}>⚖️</Text>
          </View>
          <Text style={styles.h1}>NyaySetu</Text>
          <Text style={styles.small}>न्यायसेतु · field app</Text>
        </View>

        <Card title="Sign in" subtitle="Evidence capture for police, bail check-in for the accused.">
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="officer@nyaysetu.demo"
              placeholderTextColor={colours.faint}
            />
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••••••"
              placeholderTextColor={colours.faint}
            />
          </View>

          {error ? <Notice tone="danger" title="Could not sign in" body={error} /> : null}

          <Button label="Sign in" onPress={submit} loading={pending} disabled={!email || !password} />

          <Text style={styles.small}>
            Talking to {apiBaseUrl()}. Change it with EXPO_PUBLIC_API_BASE_URL. An Android emulator
            reaches your laptop at 10.0.2.2, not localhost.
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
