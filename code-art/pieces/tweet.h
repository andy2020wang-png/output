// 程序与艺术 · Tweetable Mathematical Art —— 各作品共用的外壳
//
// Harness for entries of the Code Golf Stack Exchange challenge "Tweetable Mathematical Art"
// (https://codegolf.stackexchange.com/q/35569). It behaves like the challenge's C++ template:
// the same macros, pixels visited row by row (j outer, i inner), the red, green and blue
// functions called in that order for every pixel, results masked with the maximum value,
// samples written as a P6 stream (two bytes per sample in host order for the 10-bit version).
// The only difference: the stream goes to stdout instead of a file named MathPic.
//
// A piece defines TWEET_T (unsigned char for the 8-bit template, unsigned short for the
// 10-bit one) before including this file, then its three functions, then TWEET_MAIN(r, g, b).
#include <iostream>
#include <cmath>
#include <cstdio>
#include <cstdlib>
using std::abs;     // abs(double) must be the floating-point one (with only ::abs(int) visible,
                    // g++ would silently truncate abs(sin(x)) to 0 in "Some swirly pointy things")
#define DIM 1024
#define DM1 (DIM-1)
#define _sq(x) ((x)*(x))                       // square
#define _cb(x) abs((x)*(x)*(x))                // absolute value of cube
#define _cr(x) (TWEET_T)(pow((x),1.0/3.0))     // cube root

#define TWEET_MAIN(R, G, B)                                        \
int main(){                                                        \
    const int maxv = sizeof(TWEET_T) == 1 ? 255 : DM1;             \
    printf("P6\n%d %d\n%d\n", DIM, DIM, maxv);                     \
    for(int j=0;j<DIM;j++)                                         \
        for(int i=0;i<DIM;i++){                                    \
            TWEET_T color[3];                                      \
            color[0] = R(i,j)&maxv;                                \
            color[1] = G(i,j)&maxv;                                \
            color[2] = B(i,j)&maxv;                                \
            fwrite(color, sizeof(TWEET_T), 3, stdout);             \
        }                                                          \
    return 0;                                                      \
}
