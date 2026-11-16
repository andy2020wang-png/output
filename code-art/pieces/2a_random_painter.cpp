// Tweetable Mathematical Art
// @rank 2
// @votes 190
// @title Random painter
// @author Martin Ender
// @url https://codegolf.stackexchange.com/a/35626
// @license CC BY-SA 3.0
// @read u8
//
// The three function bodies below are the first version from Martin Ender's answer, unchanged
// (it was written for the first revision of the template, hence char and red_fn / green_fn /
// blue_fn). Everything outside the three functions belongs to this repository.
// rand() is never seeded, so the picture is the same on every run with the same C library.
#define TWEET_T unsigned char
#include "tweet.h"
char green_fn(int,int);
char blue_fn(int,int);

char red_fn(int i,int j){
#define r(n)(rand()%n)
    static char c[1024][1024];return!c[i][j]?c[i][j]=!r(999)?r(256):red_fn((i+r(2))%1024,(j+r(2))%1024):c[i][j];
}
char green_fn(int i,int j){
    static char c[1024][1024];return!c[i][j]?c[i][j]=!r(999)?r(256):green_fn((i+r(2))%1024,(j+r(2))%1024):c[i][j];
}
char blue_fn(int i,int j){
    static char c[1024][1024];return!c[i][j]?c[i][j]=!r(999)?r(256):blue_fn((i+r(2))%1024,(j+r(2))%1024):c[i][j];
}

TWEET_MAIN(red_fn, green_fn, blue_fn)
