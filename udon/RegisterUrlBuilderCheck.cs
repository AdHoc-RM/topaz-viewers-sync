using UdonSharp;
using UnityEngine;

// RegisterUrlBuilder がSPEC 5章の例の表と同じ文字列を作るかを、Play時にConsoleへ出して確かめる。
// 確認が済んだらワールドから外してよい。
public class RegisterUrlBuilderCheck : UdonSharpBehaviour
{
    public RegisterUrlBuilder builder;

    private void Start()
    {
        string[] names = { "ゆっけ", "名前#1", "A&B", "hoge fuga", "🍣すし" };
        string[] expected =
        {
            "n=308630633051&c=913a",
            "n=540d524d00230031&c=a6ae",
            "n=004100260042&c=00a9",
            "n=0068006f0067006500200066007500670061&c=0366",
            "n=d83cdf6330593057&c=184f",
        };

        int failed = 0;
        for (int i = 0; i < names.Length; i++)
        {
            string actual = builder.BuildRegisterText(names[i]);
            string want = RegisterUrlBuilder.RegisterUrl + "?" + expected[i];
            if (actual == want)
            {
                Debug.Log("[RegisterUrlBuilderCheck] OK " + names[i] + " -> " + actual);
            }
            else
            {
                failed++;
                Debug.LogError("[RegisterUrlBuilderCheck] NG " + names[i] + " -> " + actual + " (expected " + want + ")");
            }
        }

        if (failed == 0)
        {
            Debug.Log("[RegisterUrlBuilderCheck] all " + names.Length + " cases passed");
        }
        else
        {
            Debug.LogError("[RegisterUrlBuilderCheck] " + failed + " of " + names.Length + " cases failed");
        }
    }
}
