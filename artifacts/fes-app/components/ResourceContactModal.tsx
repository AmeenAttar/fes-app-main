import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ResourceContact } from "@/constants/supporting-resources";
import { useColors } from "@/hooks/useColors";
import { openMailtoDraft } from "@/lib/mailto";

function shortDisplayName(fullName: string): string {
  const first = fullName.split(/[,\s]/u)[0]?.trim();
  return first && first.length > 0 ? first : fullName;
}

function buildMailBody(
  contact: ResourceContact,
  senderName: string,
  senderEmail: string,
  message: string,
): string {
  return [
    `This message was sent from the Cleveland FES Center app (Supporting Resources).`,
    ``,
    `To: ${contact.name}`,
    ``,
    `—`,
    ``,
    `From: ${senderName}`,
    `Reply email: ${senderEmail}`,
    ``,
    message.trim(),
  ].join("\n");
}

export interface ResourceContactModalProps {
  visible: boolean;
  contact: ResourceContact | null;
  onClose: () => void;
}

export function ResourceContactModal({
  visible,
  contact,
  onClose,
}: ResourceContactModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName("");
      setEmail("");
      setMessage("");
      setError(null);
      setSending(false);
    }
  }, [visible]);

  const submit = useCallback(async () => {
    if (!contact) return;
    const n = name.trim();
    const e = email.trim();
    const m = message.trim();
    if (!n || !e || !m) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(e)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSending(true);

    const subject = `FES Center app — message for ${contact.name}`;
    const body = buildMailBody(contact, n, e, m);

    try {
      const ok = await openMailtoDraft({
        to: contact.email,
        subject,
        body,
      });
      if (ok) {
        onClose();
      } else {
        setError(
          "Couldn’t open your mail app. Add an email account or use the quick mail button on the list.",
        );
      }
    } catch {
      setError("Couldn’t open email. Try again or use your mail app directly.");
    } finally {
      setSending(false);
    }
  }, [contact, name, email, message, onClose]);

  if (!contact) return null;

  const labelFor = shortDisplayName(contact.name);
  const inputStyle = [
    styles.input,
    {
      color: colors.foreground,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: Math.max(insets.top, 12),
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.headerBtnText, { color: colors.primary }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Contact
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollBody,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.recipientLine, { color: colors.mutedForeground }]}>
            To:{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
              {contact.name}
            </Text>
          </Text>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    Name
                  </Text>
                  <Text style={[styles.req, { color: colors.destructive }]}>*</Text>
                </View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground}
                  style={inputStyle}
                  autoCapitalize="words"
                  autoCorrect
                  editable={!sending}
                />
              </View>
              <View style={styles.fieldHalf}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    Email
                  </Text>
                  <Text style={[styles.req, { color: colors.destructive }]}>*</Text>
                </View>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.org"
                  placeholderTextColor={colors.mutedForeground}
                  style={inputStyle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!sending}
                />
              </View>
            </View>

            <View style={styles.fieldFull}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Message
                </Text>
                <Text style={[styles.req, { color: colors.destructive }]}>*</Text>
              </View>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="How can they help?"
                placeholderTextColor={colors.mutedForeground}
                style={[inputStyle, styles.messageInput]}
                multiline
                textAlignVertical="top"
                editable={!sending}
              />
            </View>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}

          <Text style={[styles.finePrint, { color: colors.mutedForeground }]}>
            Opens your mail app with this draft. Send from your own account—your
            reply address is included in the message for the recipient.
          </Text>

          <Pressable
            onPress={() => void submit()}
            disabled={sending}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: sending ? 0.75 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.submitLabel, { color: colors.primaryForeground }]}>
                  Contact {labelFor}
                </Text>
                <Feather name="mail" size={20} color={colors.primaryForeground} />
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 72,
    paddingVertical: 8,
  },
  headerBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  scrollBody: {
    padding: 20,
    gap: 14,
  },
  recipientLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },
  fieldFull: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  req: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  messageInput: {
    minHeight: 120,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  finePrint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
