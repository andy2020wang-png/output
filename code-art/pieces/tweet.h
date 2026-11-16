// Tweetable Mathematical Art: the shell shared by all pieces
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
//
// Optional, also defined before including this file:
//   TWEET_GUARD   the piece writes a little past the end of its last static table (see
//                 9a_buddhabrot.cpp). Two zero pages are mapped right behind the program's static
//                 data before anything else runs, so those writes land in memory nothing else uses.
//                 piece.py checks that the table really is the last thing in the static data.
//   TWEET_CLOCK   a Unix time. time() returns it for the whole run, so an entry that calls
//                 srand(time(0)) at every pixel (see 12_random_voronoi.cpp) seeds the same
//                 sequence at every pixel, as it does on a machine that finishes within a second.
#include <iostream>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <ctime>
using std::abs;     // abs(double) must be the floating-point one (with only ::abs(int) visible,
                    // g++ would silently truncate abs(sin(x)) to 0 in "Some swirly pointy things")
#define DIM 1024
#define DM1 (DIM-1)
#define _sq(x) ((x)*(x))                       // square
#define _cb(x) abs((x)*(x)*(x))                // absolute value of cube
#define _cr(x) (TWEET_T)(pow((x),1.0/3.0))     // cube root

#ifdef TWEET_GUARD
#include <cstdint>
#include <unistd.h>
#include <sys/mman.h>
extern char _end;                              // end of the static data, provided by the linker
static void tweet_guard(){
    uintptr_t ps = sysconf(_SC_PAGESIZE), a = ((uintptr_t)&_end + ps - 1) / ps * ps;
    if(mmap((void*)a, 2*ps, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS|MAP_FIXED_NOREPLACE, -1, 0) != (void*)a){
        fprintf(stderr, "tweet.h: cannot map the guard pages\n"); exit(3);
    }
}
#else
static void tweet_guard(){}
#endif

#ifdef TWEET_CLOCK
static time_t tweet_clock(time_t *t){ if(t) *t = TWEET_CLOCK; return TWEET_CLOCK; }
#define time tweet_clock
#endif

#ifndef TWEET_MAIN          /* tools/9a_split.cpp supplies its own main and defines this away */
#define TWEET_MAIN(R, G, B)                                        \
int main(){                                                        \
    tweet_guard();                                                 \
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
#endif
