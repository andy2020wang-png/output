// Tweetable Mathematical Art
// @rank 8
// @votes 103
// @title Untitled
// @author faubi
// @url https://codegolf.stackexchange.com/a/35596
// @license CC BY-SA 3.0
// @read im16
//
// The three function bodies below are faubi's answer, unchanged. The answer has no heading
// (hence "Untitled") and gives only the bodies, marked RED, GREEN and BLUE; the signatures here
// are those of the challenge's 10-bit template. Everything outside the bodies belongs to this
// repository.
#define TWEET_T unsigned short
#include "tweet.h"
unsigned short GR(int,int);
unsigned short BL(int,int);

unsigned short RD(int i,int j){
    int a=(j?i%j:i)*4;int b=i-32;int c=j-32;return _sq(abs(i-512))+_sq(abs(j-512))>_sq(384)?a:int(sqrt((b+c)/2))^_cb((b-c)*2);
}
unsigned short GR(int i,int j){
    int a=(j?i%j:i)*4;return _sq(abs(i-512))+_sq(abs(j-512))>_sq(384)?a:int(sqrt((i+j)/2))^_cb((i-j)*2);
}
unsigned short BL(int i,int j){
    int a=(j?i%j:i)*4;int b=i+32;int c=j+32;return _sq(abs(i-512))+_sq(abs(j-512))>_sq(384)?a:int(sqrt((b+c)/2))^_cb((b-c)*2);
}

TWEET_MAIN(RD, GR, BL)
