import { supabase } from './supabase'

export async function logActivity(activityType, description, metadata = {}) {
  try {
    const { error } = await supabase.from('activity_history').insert({
      activity_type: activityType,
      description,
      metadata,
    })
    if (error) console.error('Failed to log activity:', error)
  } catch (err) {
    console.error('Error logging activity:', err)
  }
}
