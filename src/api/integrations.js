import { supabase } from './supabaseClient';




export const Core = supabase.integrations.Core;

export const InvokeLLM = supabase.integrations.Core.InvokeLLM;

export const SendEmail = supabase.integrations.Core.SendEmail;

export const UploadFile = supabase.integrations.Core.UploadFile;

export const GenerateImage = supabase.integrations.Core.GenerateImage;

export const ExtractDataFromUploadedFile = supabase.integrations.Core.ExtractDataFromUploadedFile;

export const CreateFileSignedUrl = supabase.integrations.Core.CreateFileSignedUrl;

export const UploadPrivateFile = supabase.integrations.Core.UploadPrivateFile;






