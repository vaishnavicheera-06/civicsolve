import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xqhosvvnzpauljstyfgh.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaG9zdnZuenBhdWxqc3R5ZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzI0MTgsImV4cCI6MjA4NDkwODQxOH0.RaDOGdqI4wLdkl1wueJdsr4BMKBdHZST23NQ21l0iE0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);