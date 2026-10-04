using System;
using System.Collections;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace Voxy.Runtime
{
    internal static class Program
    {
        // Chave compartilhada para assinatura criptográfica do sinal de idade nativo
        private const string InternalSecret = "v0xy_4g3_s1gn4l_s3cur1ty_pr0t0c0l_2026_k3y";

        [STAThread]
        private static void Main(string[] args)
        {
            string nonce = args.Length > 0 ? args[0] : Guid.NewGuid().ToString("N");
            long parsedTs;
            long timestamp = args.Length > 1 && long.TryParse(args[1], out parsedTs) 
                ? parsedTs 
                : (long)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalMilliseconds;

            try
            {
                Type userType = Type.GetType("Windows.System.User, Windows.System, ContentType=WindowsRuntime");
                if (userType == null)
                {
                    OutputSignedResult(false, 0, 0, "NoWinRT", nonce, timestamp);
                    return;
                }

                MethodInfo findAllAsync = userType.GetMethod("FindAllAsync", Type.EmptyTypes);
                if (findAllAsync == null)
                {
                    OutputSignedResult(false, 0, 0, "NoFindAllAsync", nonce, timestamp);
                    return;
                }

                object asyncOp = findAllAsync.Invoke(null, null);
                Type extType = Type.GetType("System.WindowsRuntimeSystemExtensions, System.Runtime.WindowsRuntime, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089")
                            ?? Type.GetType("System.WindowsRuntimeSystemExtensions, System.Runtime.WindowsRuntime");

                MethodInfo asTaskGeneric = null;
                if (extType != null)
                {
                    foreach (var m in extType.GetMethods())
                    {
                        if (m.Name == "AsTask" && m.GetParameters().Length == 1 && m.IsGenericMethod)
                        {
                            asTaskGeneric = m;
                            break;
                        }
                    }
                }

                if (asTaskGeneric == null)
                {
                    OutputSignedResult(false, 0, 0, "NoAsTask", nonce, timestamp);
                    return;
                }

                Type listType = Type.GetType("System.Collections.Generic.IReadOnlyList`1[[Windows.System.User, Windows.System, ContentType=WindowsRuntime]]");
                dynamic task = asTaskGeneric.MakeGenericMethod(listType).Invoke(null, new object[] { asyncOp });
                task.Wait();
                IEnumerable users = (IEnumerable)task.Result;

                object targetUser = null;
                foreach (var u in users)
                {
                    targetUser = u;
                    break;
                }

                if (targetUser == null)
                {
                    OutputSignedResult(false, 0, 0, "NoUsers", nonce, timestamp);
                    return;
                }

                Type ageRangeType = Type.GetType("Windows.System.UserAgeRange, Windows.System, ContentType=WindowsRuntime");
                Type statusType = Type.GetType("Windows.System.UserAgeVerificationStatus, Windows.System, ContentType=WindowsRuntime");

                dynamic rangeTask = null;
                try
                {
                    MethodInfo getRangeMethod = targetUser.GetType().GetMethod("GetUserAgeRangeAsync");
                    if (getRangeMethod != null)
                    {
                        object rangeOp = getRangeMethod.Invoke(targetUser, null);
                        rangeTask = asTaskGeneric.MakeGenericMethod(ageRangeType).Invoke(null, new object[] { rangeOp });
                        rangeTask.Wait();
                    }
                }
                catch {}

                dynamic statusTask = null;
                try
                {
                    MethodInfo getStatusMethod = targetUser.GetType().GetMethod("GetAgeVerificationStatusAsync");
                    if (getStatusMethod != null)
                    {
                        object statusOp = getStatusMethod.Invoke(targetUser, null);
                        statusTask = asTaskGeneric.MakeGenericMethod(statusType).Invoke(null, new object[] { statusOp });
                        statusTask.Wait();
                    }
                }
                catch {}

                dynamic range = rangeTask != null ? rangeTask.Result : null;
                dynamic status = statusTask != null ? statusTask.Result : null;

                string statusStr = status != null ? status.ToString() : "Unknown";

                if (range != null)
                {
                    int lower = (int)range.Lower;
                    int upper = (int)range.Upper == int.MaxValue ? 999 : (int)range.Upper;
                    OutputSignedResult(true, lower, upper, statusStr, nonce, timestamp);
                }
                else
                {
                    OutputSignedResult(false, 0, 0, statusStr, nonce, timestamp);
                }
            }
            catch (Exception ex)
            {
                OutputSignedResult(false, 0, 0, "Error: " + ex.Message.Replace("\"", "'"), nonce, timestamp);
            }
        }

        private static void OutputSignedResult(bool available, int lower, int upper, string status, string nonce, long timestamp)
        {
            // Gera payload padronizado para assinatura HMAC-SHA256
            string canonicalData = string.Format("{0}:{1}:{2}:{3}:{4}:{5}", 
                available ? "true" : "false", 
                lower, 
                upper, 
                status, 
                timestamp, 
                nonce);

            string signature;
            using (HMACSHA256 hmac = new HMACSHA256(Encoding.UTF8.GetBytes(InternalSecret)))
            {
                byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonicalData));
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hash)
                {
                    sb.Append(b.ToString("x2"));
                }
                signature = sb.ToString();
            }

            string json = string.Format(
                "{{\"available\":{0},\"lower\":{1},\"upper\":{2},\"status\":\"{3}\",\"nonce\":\"{4}\",\"timestamp\":{5},\"signature\":\"{6}\"}}",
                available ? "true" : "false",
                lower,
                upper,
                status,
                nonce,
                timestamp,
                signature
            );

            Console.WriteLine(json);
        }
    }
}
