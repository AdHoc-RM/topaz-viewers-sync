using UdonSharp;

// 名前を登録用のURL文字列に変換する（SPEC 5章）。
// VRChatではワールドが作った文字列をそのままURLとして読み込めないため、
// 戻り値を画面に表示し、利用者にVRCUrlInputFieldへコピーしてもらう（SPEC 4章）。
public class RegisterUrlBuilder : UdonSharpBehaviour
{
    // 名前の受け取り口（SPEC 7.1）
    public const string RegisterUrl = "https://topaz-viewers-sync.dawn-water-d8cd.workers.dev/r";

    public string BuildRegisterText(string name)
    {
        string n = "";
        int sum = 0;
        for (int i = 0; i < name.Length; i++)
        {
            // UTF-16のコード単位ごとに変換する。絵文字はサロゲートペアの2単位になり、受け取り口で1文字に戻す
            int u = name[i];
            n += u.ToString("x4");
            sum = (sum + u) % 65536;
        }
        return RegisterUrl + "?n=" + n + "&c=" + sum.ToString("x4");
    }
}
