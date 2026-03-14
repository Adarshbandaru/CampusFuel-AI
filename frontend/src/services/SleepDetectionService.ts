import { AppState, AppStateStatus } from 'react-native';
import axios from 'axios';

class SleepDetectionService {
  private lastBackgroundTime: number | null = null;
  private isTracking: boolean = false;

  public startTracking() {
    if (this.isTracking) return;
    this.isTracking = true;

    AppState.addEventListener('change', this.handleAppStateChange);
    console.log('[SleepDetectionService] Started proxy hardware tracking via AppState.');
  }

  public stopTracking() {
      this.isTracking = false;
      // Note: in a real implementation we would remove the listener here.
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Proxy for screen turning off or user leaving phone
      this.lastBackgroundTime = Date.now();
      console.log(`[SleepDetectionService] Phone locked/slept at ${new Date(this.lastBackgroundTime).toLocaleTimeString()}`);
    } 
    else if (nextAppState === 'active') {
      // Proxy for screen turning on / unlocking
      if (this.lastBackgroundTime) {
         const wakeTime = Date.now();
         const sleepDurationMs = wakeTime - this.lastBackgroundTime;
         const sleepDurationMinutes = sleepDurationMs / (1000 * 60);

         console.log(`[SleepDetectionService] Phone unlocked at ${new Date(wakeTime).toLocaleTimeString()}. Inactive for ${sleepDurationMinutes.toFixed(2)} mins.`);

         // If the phone was untouched for more than 45 minutes, classify it as a Sleep Session
         if (sleepDurationMinutes >= 45) {
             console.log('[SleepDetectionService] 🧠 45+ minute inactivity threshold met. Firing Auto-Sleep endpoint.');
             
             try {
                const sleepStartIso = new Date(this.lastBackgroundTime).toISOString();
                const sleepEndIso = new Date(wakeTime).toISOString();
                
                await axios.post('http://10.0.2.2:8000/users/user123/sleep/auto', {
                    sleep_start: sleepStartIso,
                    sleep_end: sleepEndIso
                });
             } catch(e) {
                 console.log('[SleepDetectionService] Error logging auto-sleep', e);
             }
         }
      }
      this.lastBackgroundTime = null; // Reset
    }
  };

  /**
   * Allows the UI to instantly simulate an 8 hour overnight cycle to verify the backend AI responses
   */
  public async simulateOvernightSleep(hours: number = 7.7) {
      const wakeTime = new Date();
      const sleepStart = new Date(wakeTime.getTime() - (hours * 60 * 60 * 1000));
      
      try {
         const res = await axios.post('http://10.0.2.2:8000/users/user123/sleep/auto', {
             sleep_start: sleepStart.toISOString(),
             sleep_end: wakeTime.toISOString()
         });
         return res.data;
      } catch (e) {
         throw e;
      }
  }
}

export default new SleepDetectionService();
