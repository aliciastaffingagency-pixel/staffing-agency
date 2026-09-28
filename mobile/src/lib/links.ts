import * as WebBrowser from 'expo-web-browser'
import { websiteUrl } from './api'

// Opens a page of the website (privacy policy, terms, account settings…) in an in-app browser tab.
export const openWebsite = (path: string) => WebBrowser.openBrowserAsync(websiteUrl(path))
