import React from 'react';
import { Pulse } from './MicroMotion';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from './Icon';
export const colors = { ink: '#F4F5F6', muted: '#969BA3', canvas: '#111315', line: '#2C3035', olive: '#CDD9BA', pale: '#24292B' };
export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 32, fontWeight: '600', letterSpacing: -1.2, color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#1C1F23', borderRadius: 14, padding: 15, fontSize: 15, color: colors.ink, minHeight: 50 },
  section: { gap: 20, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
});
export function Button({ title, onPress, outline, loading, disabled, icon }: { title: string; onPress: () => void; outline?: boolean; loading?: boolean; disabled?: boolean; icon?: IconName }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled || !!loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => ({ minHeight: 50, paddingHorizontal: 20, borderRadius: 25, backgroundColor: outline ? 'transparent' : colors.ink, borderWidth: 1, borderColor: outline ? colors.line : colors.ink, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10, opacity: disabled || loading ? .5 : pressed ? .75 : 1 })}>
    {loading ? <ActivityIndicator color={outline ? colors.ink : colors.canvas} /> : <><Text style={{ color: outline ? colors.ink : colors.canvas, fontSize: 14, fontWeight: '600' }}>{title}</Text>{icon && <Icon name={icon} size={18} color={outline ? colors.ink : colors.canvas} />}</>}
  </Pressable>;
}
export function IconButton({ name, label, onPress, filled, color, background, disabled }: { name: IconName; label: string; onPress: () => void; filled?: boolean; color?: string; background?: string; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: background, justifyContent: 'center', alignItems: 'center', opacity: pressed ? .5 : 1 })}><Pulse trigger={!!filled} enabled={['bookmark', 'heart'].includes(name) && !!filled}><Icon name={name} filled={filled} color={color} size={22} /></Pulse></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#9B9D94" {...props} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, props.style]} /></View>; }
export function ErrorText({ message }: { message: string }) { return message ? <Text accessibilityRole="alert" style={{ color: '#F59B91', fontSize: 13, lineHeight: 20 }}>{message}</Text> : null; }
export function Page({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: boolean; children: React.ReactNode }) {
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 125 }}><View style={{ width: '100%', maxWidth: 840, alignSelf: 'center' }}>
    {back && <View style={{ alignSelf: 'flex-start', marginBottom: 8, marginLeft: -12 }}><IconButton name="back" label="Geri dön" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /></View>}
    <Text style={styles.title}>{title}</Text>{subtitle && <Text style={[styles.subtitle, { marginTop: 8, marginBottom: 12 }]}>{subtitle}</Text>}{children}
  </View></ScrollView>;
}
export function Empty({ icon = 'bag', title, description, action }: { icon?: IconName; title: string; description: string; action?: { title: string; onPress: () => void } }) {
  return <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 70, gap: 16, paddingHorizontal: 20 }}><View style={{ padding: 22, borderRadius: 50, backgroundColor: colors.pale }}><Icon name={icon} size={30} color={colors.olive} /></View><Text style={{ fontSize: 22, fontWeight: '600', color: colors.ink, textAlign: 'center' }}>{title}</Text><Text style={[styles.subtitle, { textAlign: 'center', maxWidth: 300 }]}>{description}</Text>{action && <Button {...action} />}</View>;
}
