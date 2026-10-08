import { Redirect } from 'expo-router';
// Seller management is a web-only entry point and never enters the native app.
export default function StudioUnavailableOnNative() { return <Redirect href="/" />; }
